// The buyer's side, reached only with the order id and its secret token.
//   {action: "check"}  while the order is still pending, asks Kashier directly whether it was
//                      paid (for when the webhook is late). Marks it paid only through
//                      public.store_mark_paid (exact amount and currency).
//   {action: "file", item}  a paid order gets a link to its book that works for a few minutes.
//                      Books for sale sit in a PRIVATE GitHub repository; GitHub itself hands
//                      out the short-lived link, so nothing passes through Supabase.
// Secrets: KASHIER_MODE, KASHIER_SECRET_KEY, BOOKS_REPO (owner/repo), BOOKS_GITHUB_TOKEN
// (fine-grained, read-only Contents on BOOKS_REPO). Deploy with "Verify JWT" OFF.

const SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODE = Deno.env.get('KASHIER_MODE') === 'live' ? 'live' : 'test';
const SECRET = Deno.env.get('KASHIER_SECRET_KEY') || '';
const KASHIER = MODE === 'live' ? 'https://api.kashier.io' : 'https://test-api.kashier.io';
const BOOKS_REPO = (Deno.env.get('BOOKS_REPO') || 'walid-salama/paid-books').toLowerCase();
const GH_TOKEN = Deno.env.get('BOOKS_GITHUB_TOKEN') || '';
// One download per order, on one device. The first download ties the order to the buyer's
// device; the same device may ask again for GRACE_MS (a dropped connection), then it closes.
const GRACE_MS = 15 * 60 * 1000;
const ORIGINS = ['https://walid-salama.github.io', 'https://abu-hanin.pages.dev', 'http://localhost:8080', 'http://127.0.0.1:8080'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function db(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (SERVICE.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE}`;
  return fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
}

// Asks Kashier for the order. Paid only if a successful payment for exactly this amount shows up.
async function askKashier(order: Record<string, any>) {
  if (!SECRET) return null;
  const r = await fetch(`${KASHIER}/v3/payment/orders?search=${encodeURIComponent(order.id)}`, { headers: { Authorization: SECRET } });
  const body = await r.json().catch(() => ({}));
  const list: any[] = Array.isArray(body.data) ? body.data : [];
  const mine = list.filter(o => String(o.merchantOrderId || '') === order.id);
  let paid: any = null;
  for (const o of mine) {
    const okOrder = ['CAPTURED', 'PAID', 'SUCCESS'].includes(String(o.status || '').toUpperCase());
    const tx = (Array.isArray(o.transactions) ? o.transactions : []).find((t: any) => String(t.status || '').toUpperCase() === 'SUCCESS');
    if (okOrder || tx) { paid = { o, tx }; break; }
  }
  await db('payment_events', {
    method: 'POST',
    body: JSON.stringify({ order_id: order.id, source: 'check', valid: !!paid, status: paid ? 'SUCCESS' : `http:${r.status}`, payload: body }),
  });
  if (!paid) return null;
  const amount = Number(paid.o.amount ?? paid.o.totalAmount ?? paid.tx?.amount ?? NaN);
  const currency = String(paid.o.currency ?? paid.tx?.currency ?? 'EGP');
  return { amount, currency, transaction: paid.tx?.transactionId ?? null, kashierOrder: paid.o.orderId ?? paid.o._id ?? null };
}

async function githubLink(url: string) {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/?#]+)$/);
  if (!m || `${m[1]}/${m[2]}`.toLowerCase() !== BOOKS_REPO) return url; // a public file: its own link
  if (!GH_TOKEN) throw new Error('no_token');
  const gh = (path: string, extra: Record<string, string> = {}) => fetch(`https://api.github.com/repos/${m[1]}/${m[2]}${path}`, {
    headers: { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'abu-hanin-store', 'X-GitHub-Api-Version': '2022-11-28', ...extra },
    redirect: 'manual',
  });
  const rel = await gh(`/releases/tags/${m[3]}`, { Accept: 'application/vnd.github+json' });
  if (!rel.ok) throw new Error(`release_${rel.status}`);
  const name = decodeURIComponent(m[4]);
  const asset = ((await rel.json()).assets || []).find((a: any) => a.name === name);
  if (!asset) throw new Error('asset_missing');
  const file = await gh(`/releases/assets/${asset.id}`, { Accept: 'application/octet-stream' });
  const loc = file.headers.get('location');
  await file.body?.cancel();
  if (!loc) throw new Error(`asset_${file.status}`);
  return loc;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json(req, { error: 'bad_json' }, 400); }
  const id = String(input.order || ''), token = String(input.token || '');
  if (!UUID.test(id) || !UUID.test(token)) return json(req, { error: 'not_found' }, 404);

  const or = await db(`orders?id=eq.${id}&token=eq.${token}&select=*`);
  const order = or.ok ? (await or.json())[0] : null;
  if (!order) return json(req, { error: 'not_found' }, 404);

  if (input.action === 'check') {
    if (order.status !== 'pending') return json(req, { status: order.status });
    const k = await askKashier(order);
    if (!k) return json(req, { status: 'pending' });
    const r = await db('rpc/store_mark_paid', {
      method: 'POST',
      body: JSON.stringify({ p_order: id, p_amount: k.amount, p_currency: k.currency, p_transaction: k.transaction ? String(k.transaction) : null, p_kashier_order: k.kashierOrder ? String(k.kashierOrder) : null }),
    });
    const res = r.ok ? await r.json() : 'error';
    return json(req, { status: res === 'paid' || res === 'already_paid' ? 'paid' : 'pending', note: res });
  }

  if (input.action === 'file') {
    if (order.status !== 'paid') return json(req, { error: 'not_paid', message: 'الطلب لسه مش مدفوع.' }, 403);
    const device = String(input.device || '');
    if (!UUID.test(device)) return json(req, { error: 'no_device', message: 'حدّث الصفحة وحاول تاني.' }, 400);
    if (order.first_download_at) {
      const late = Date.now() - new Date(order.first_download_at).getTime() > GRACE_MS;
      if (order.download_device !== device) return json(req, { error: 'other_device', message: 'الكتاب ده اتحمّل قبل كده على جهاز تاني. التحميل مسموح مرة واحدة بس.' }, 403);
      if (late) return json(req, { error: 'used', message: 'الكتاب ده اتحمّل خلاص. التحميل مسموح مرة واحدة بس.' }, 403);
    }
    const cr = await db(`post_content?post_id=eq.${order.post_id}&select=items`);
    const items: any[] = cr.ok ? ((await cr.json())[0]?.items || []) : [];
    const item = items.find(i => i.type === 'file' && String(i.id) === String(input.item || ''));
    if (!item || !/^https:\/\//.test(String(item.value || ''))) return json(req, { error: 'no_file', message: 'الملف مش موجود. تواصل معانا.' }, 404);
    let url: string;
    try { url = await githubLink(String(item.value)); }
    catch (e) { return json(req, { error: 'file_unavailable', message: 'تعذر تجهيز رابط التحميل. حاول تاني بعد دقيقة.', detail: String((e as Error).message) }, 502); }
    const now = new Date().toISOString();
    if (!order.first_download_at) {
      // Claimed only if nobody claimed it in the meantime (two devices at the same second).
      const claim = await db(`orders?id=eq.${id}&first_download_at=is.null`, {
        method: 'PATCH',
        body: JSON.stringify({ first_download_at: now, download_device: device, downloads: order.downloads + 1, updated_at: now }),
      });
      const won = claim.ok ? (await claim.json()).length : 0;
      if (!won) return json(req, { error: 'other_device', message: 'الكتاب ده اتحمّل قبل كده على جهاز تاني. التحميل مسموح مرة واحدة بس.' }, 403);
    } else {
      await db(`orders?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ downloads: order.downloads + 1, updated_at: now }) });
    }
    return json(req, { url, name: item.fileName || item.label || 'book.pdf' });
  }
  return json(req, { error: 'bad_action' }, 400);
});
