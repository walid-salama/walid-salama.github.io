// Starts a purchase: checks the book and its price in the database (never the price the
// browser sends), creates a pending order, and opens a Kashier payment session for it.
// Secrets (Supabase > Edge Functions > Secrets), entered by the owner:
//   KASHIER_MODE = test | live, KASHIER_MID, KASHIER_API_KEY (Payment API key), KASHIER_SECRET_KEY, SITE_URL
// Deploy with "Verify JWT" OFF: visitors call it with no account.

const SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODE = Deno.env.get('KASHIER_MODE') === 'live' ? 'live' : 'test';
const MID = Deno.env.get('KASHIER_MID') || '';
const API_KEY = Deno.env.get('KASHIER_API_KEY') || '';
const SECRET = Deno.env.get('KASHIER_SECRET_KEY') || '';
const SITE = (Deno.env.get('SITE_URL') || 'https://walid-salama.github.io').replace(/\/+$/, '');
const KASHIER = MODE === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io';
const ORIGINS = ['https://walid-salama.github.io', 'https://abu-hanin.pages.dev', 'http://localhost:8080', 'http://127.0.0.1:8080'];

function cors(req: Request) {
  const o = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Vary': 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

// Database through PostgREST with the service key (no extra libraries to load).
function db(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (SERVICE.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE}`;
  return fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  if (!MID || !API_KEY || !SECRET) return json(req, { error: 'not_configured', message: 'الدفع لسه مش متفعّل على الموقع.' }, 503);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json(req, { error: 'bad_json' }, 400); }

  const slug = clean(input.slug, 61).toLowerCase();
  const name = clean(input.name, 80);
  const email = clean(input.email, 120).toLowerCase();
  const phone = clean(input.phone, 20).replace(/[\s-]/g, '');
  // The buyer fills in nothing on the site (one tap to Kashier). Details, if ever sent, are checked.
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return json(req, { error: 'bad_slug' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return json(req, { error: 'bad_email', message: 'اكتب بريد إلكتروني صحيح.' }, 400);
  if (phone && !/^\+?\d{8,15}$/.test(phone)) return json(req, { error: 'bad_phone', message: 'اكتب رقم موبايل صحيح.' }, 400);

  // The book and its price come from the database only.
  const pr = await db(`posts?slug=eq.${encodeURIComponent(slug)}&select=id,title,paid,price,status,expires_at`);
  const post = pr.ok ? (await pr.json())[0] : null;
  if (!post || !post.paid || post.status === 'draft' || !(Number(post.price) >= 5)
      || (post.expires_at && new Date(post.expires_at) < new Date())) {
    return json(req, { error: 'not_for_sale', message: 'الكتاب ده مش متاح للبيع دلوقتي.' }, 404);
  }
  const amount = Number(post.price).toFixed(2);

  const or = await db('orders', {
    method: 'POST',
    body: JSON.stringify({ post_id: post.id, title: post.title, amount, currency: 'EGP', name, email, phone, mode: MODE }),
  });
  if (!or.ok) return json(req, { error: 'order_failed', message: 'تعذر إنشاء الطلب. حاول تاني.' }, 500);
  const order = (await or.json())[0];

  const back = `${SITE}/order.html?o=${order.id}&t=${order.token}`;
  const ks = await fetch(`${KASHIER}/v3/payment/sessions`, {
    method: 'POST',
    headers: { Authorization: SECRET, 'api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantId: MID,
      order: order.id,
      amount,
      currency: 'EGP',
      paymentType: 'credit',
      type: 'one-time',
      // No allowedMethods: the page offers every method active on the Kashier account
      // (cards, wallets, InstaPay, installments, buy now pay later, Basata).
      display: 'ar',
      description: post.title.slice(0, 120),
      merchantRedirect: back,
      failureRedirect: false,
      serverWebhook: `${SB}/functions/v1/kashier-webhook`,
      expireAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      maxFailureAttempts: 3,
      enable3DS: true,
      brandColor: '#10e08a',
      customer: email ? { email, reference: order.id } : { reference: order.id },
      metaData: { slug },
    }),
  });
  const session = await ks.json().catch(() => ({}));
  if (!ks.ok || !session.sessionUrl) {
    await db('payment_events', { method: 'POST', body: JSON.stringify({ order_id: order.id, source: 'session', valid: false, status: String(ks.status), payload: session }) });
    return json(req, { error: 'gateway', message: 'بوابة الدفع مش بترد دلوقتي. حاول تاني بعد شوية.' }, 502);
  }
  await db(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ session_id: session._id || session.id || null, updated_at: new Date().toISOString() }) });

  // Kashier's own example opens a test session with ?mode=test.
  let url = String(session.sessionUrl);
  if (MODE === 'test' && !/[?&]mode=/.test(url)) url += `${url.includes('?') ? '&' : '?'}mode=test`;
  return json(req, { url, order: order.id, token: order.token, mode: MODE });
});
