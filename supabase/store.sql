-- =====================================================================
-- Paid books (Kashier). Run AFTER setup.sql, in Supabase > SQL Editor.
-- Safe to re-run. Free posts keep working exactly as before.
-- =====================================================================

-- ------------------------------------------------------------ posts: sale
-- paid: the post is a book for sale (no steps; bought with a card through Kashier).
-- price: in Egyptian pounds. book: what the page shows under the title
--   {"pages": 374, "language": "ar", "format": "PDF", "size": "12 ميجا", "features": ["..."]}
alter table public.posts add column if not exists paid  boolean not null default false;
alter table public.posts add column if not exists price numeric(10,2);
alter table public.posts add column if not exists book  jsonb not null default '{}'::jsonb;
alter table public.posts drop constraint if exists posts_price_ok;
alter table public.posts add constraint posts_price_ok
  check (not paid or (price is not null and price >= 5 and price <= 100000));

-- ---------------------------------------------------------------- orders
-- One row per checkout. Only the server functions (service role) write here; the owner
-- reads it in the dashboard. The buyer reaches their order with (id, token) only.
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  token            uuid not null default gen_random_uuid(),
  post_id          uuid references public.posts(id) on delete set null,
  title            text not null default '',
  amount           numeric(10,2) not null check (amount > 0),
  currency         text not null default 'EGP',
  status           text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  name             text not null default '',
  email            text not null default '',
  phone            text not null default '',
  mode             text not null default 'test' check (mode in ('test','live')),
  session_id       text,
  kashier_order_id text,
  transaction_id   text,
  downloads        int not null default 0,
  created_at       timestamptz not null default now(),
  paid_at          timestamptz,
  updated_at       timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_post_idx on public.orders (post_id);

-- Every message from Kashier, kept as it arrived (for checking any payment later).
create table if not exists public.payment_events (
  id         bigint generated always as identity primary key,
  order_id   uuid,
  source     text not null,           -- 'webhook' or 'check'
  valid      boolean not null,        -- signature / server check passed
  status     text,
  amount     numeric(10,2),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_order_idx on public.payment_events (order_id);

alter table public.orders         enable row level security;
alter table public.payment_events enable row level security;
revoke all on public.orders, public.payment_events from anon, authenticated;
grant select on public.orders, public.payment_events to authenticated;

drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists events_admin on public.payment_events;
create policy events_admin on public.payment_events for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ------------------------------------------------- functions for visitors
create or replace function public.get_post(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', p.slug, 'title', p.title, 'description', p.description,
    'cover_url', p.cover_url, 'status', p.status,
    'steps', case when p.paid then '[]'::jsonb else p.steps end, 'theme', p.theme,
    'expires_at', p.expires_at, 'views', p.views, 'unlocks', p.unlocks, 'created_at', p.created_at,
    'expired', (p.expires_at is not null and p.expires_at < now()),
    'paid', p.paid, 'price', p.price, 'book', p.book,
    'items_summary', coalesce((
      select jsonb_agg(jsonb_build_object('type', i->>'type', 'label', i->>'label'))
      from jsonb_array_elements(c.items) i
    ), '[]'::jsonb)
  )
  from public.posts p
  left join public.post_content c on c.post_id = p.id
  where p.slug = p_slug and p.status <> 'draft';
$$;

create or replace function public.list_public_posts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) from (
    select slug, title, cover_url, views, unlocks, created_at, paid, price,
           nullif(book->>'pages', '') as pages
    from public.posts
    where status = 'public' and (expires_at is null or expires_at > now())
    order by created_at desc limit 60
  ) t;
$$;

-- A paid book never opens through the free door, whatever the visitor sends.
create or replace function public.unlock_post(
  p_slug text,
  p_google_token text default null,
  p_pass uuid default null,
  p_count boolean default false
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_post public.posts%rowtype;
  v_step jsonb;
  v_ref text;
  v_key text;
  v_res text;
  v_pass uuid := p_pass;
  v_verified jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_google_error boolean := false;
  v_items jsonb;
begin
  select * into v_post from public.posts where slug = p_slug and status <> 'draft';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_post.paid then return jsonb_build_object('ok', false, 'reason', 'paid'); end if;
  if v_post.expires_at is not null and v_post.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  for v_step in select s from jsonb_array_elements(v_post.steps) s
                where coalesce((s->>'verify')::boolean, false) loop
    v_ref := private.channel_ref(v_step->>'target');
    v_key := lower(coalesce(v_ref, ''));

    if p_pass is not null and exists (
      select 1 from public.subscriber_passes sp
      where sp.pass = p_pass and sp.channel_key = v_key
        and sp.verified_at > now() - interval '30 days'
    ) then
      v_verified := v_verified || to_jsonb(v_step->>'id');
      continue;
    end if;

    if p_google_token is null then
      v_missing := v_missing || to_jsonb(v_step->>'id');
      continue;
    end if;

    v_res := private.is_subscribed(v_ref, p_google_token);
    if v_res = 'yes' then
      v_pass := coalesce(v_pass, gen_random_uuid());
      insert into public.subscriber_passes (pass, channel_key) values (v_pass, v_key)
      on conflict (pass, channel_key) do update set verified_at = now();
      v_verified := v_verified || to_jsonb(v_step->>'id');
    else
      if v_res = 'error' then v_google_error := true; end if;
      v_missing := v_missing || to_jsonb(v_step->>'id');
    end if;
  end loop;

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_google_error then 'google_error'
                     when p_google_token is null then 'needs_verification'
                     else 'not_subscribed' end,
      'verified', v_verified, 'missing', v_missing, 'pass', v_pass
    );
  end if;

  if p_count then
    update public.posts set unlocks = unlocks + 1 where id = v_post.id;
  end if;

  select items into v_items from public.post_content where post_id = v_post.id;
  return jsonb_build_object(
    'ok', true, 'verified', v_verified, 'pass', v_pass,
    'items', coalesce(v_items, '[]'::jsonb)
  );
end $$;

-- The buyer's order page. Needs both the order id and its secret token.
-- File links are never returned here: the download function hands out a short-lived one.
create or replace function public.get_order(p_id uuid, p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'amount', o.amount, 'currency', o.currency,
    'title', coalesce(p.title, o.title), 'slug', p.slug, 'cover_url', p.cover_url, 'book', p.book,
    'created_at', o.created_at, 'paid_at', o.paid_at, 'downloads', o.downloads, 'mode', o.mode,
    'files', case when o.status = 'paid' then coalesce((
      select jsonb_agg(jsonb_build_object('id', i->>'id', 'label', i->>'label', 'fileName', i->>'fileName'))
      from public.post_content c, jsonb_array_elements(c.items) i
      where c.post_id = o.post_id and i->>'type' = 'file'
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.orders o
  left join public.posts p on p.id = o.post_id
  where o.id = p_id and o.token = p_token;
$$;

-- ---------------------------------------------- for the server functions only
-- Marks an order paid once, if the amount and currency match exactly, and counts the buyer.
create or replace function public.store_mark_paid(
  p_order uuid, p_amount numeric, p_currency text,
  p_transaction text, p_kashier_order text
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order for update;
  if not found then return 'not_found'; end if;
  if v.status = 'paid' then return 'already_paid'; end if;
  if p_amount is null or round(p_amount, 2) <> v.amount or upper(coalesce(p_currency, '')) <> v.currency then
    return 'amount_mismatch';
  end if;
  update public.orders
     set status = 'paid', paid_at = now(), updated_at = now(),
         transaction_id = coalesce(p_transaction, transaction_id),
         kashier_order_id = coalesce(p_kashier_order, kashier_order_id)
   where id = p_order;
  update public.posts set unlocks = unlocks + 1 where id = v.post_id;
  return 'paid';
end $$;

revoke execute on function public.get_post(text) from public;
revoke execute on function public.list_public_posts() from public;
revoke execute on function public.unlock_post(text, text, uuid, boolean) from public;
revoke execute on function public.get_order(uuid, uuid) from public;
revoke execute on function public.store_mark_paid(uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.get_post(text) to anon, authenticated;
grant execute on function public.list_public_posts() to anon, authenticated;
grant execute on function public.unlock_post(text, text, uuid, boolean) to anon, authenticated;
grant execute on function public.get_order(uuid, uuid) to anon, authenticated;
grant execute on function public.store_mark_paid(uuid, numeric, text, text, text) to service_role;
notify pgrst, 'reload schema';

-- ----------------------------------------------------- one download per order
-- The book downloads ONCE, on ONE device. The first download ties the order to that device;
-- for 15 minutes the same device may ask again (a dropped connection), then it closes for good.
alter table public.orders add column if not exists first_download_at timestamptz;
alter table public.orders add column if not exists download_device text;

create or replace function public.get_order(p_id uuid, p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'amount', o.amount, 'currency', o.currency,
    'title', coalesce(p.title, o.title), 'slug', p.slug, 'cover_url', p.cover_url, 'book', p.book,
    'created_at', o.created_at, 'paid_at', o.paid_at, 'downloads', o.downloads, 'mode', o.mode,
    'first_download_at', o.first_download_at,
    'download_open', (o.first_download_at is null or now() - o.first_download_at < interval '15 minutes'),
    'files', case when o.status = 'paid' then coalesce((
      select jsonb_agg(jsonb_build_object('id', i->>'id', 'label', i->>'label', 'fileName', i->>'fileName'))
      from public.post_content c, jsonb_array_elements(c.items) i
      where c.post_id = o.post_id and i->>'type' = 'file'
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.orders o
  left join public.posts p on p.id = o.post_id
  where o.id = p_id and o.token = p_token;
$$;
revoke execute on function public.get_order(uuid, uuid) from public;
grant execute on function public.get_order(uuid, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
