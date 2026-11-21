// Kashier calls this after every payment event. It is the only thing that marks an order
// paid: the signature must match (HMAC-SHA256 with the Payment API key), and the amount and
// currency must equal the order exactly (public.store_mark_paid). Every call is kept in
// public.payment_events. Deploy with "Verify JWT" OFF: Kashier sends no Supabase key.
// Secrets: KASHIER_API_KEY (same as store-checkout).

const SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('KASHIER_API_KEY') || '';

function db(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (SERVICE.startsWith('eyJ')) headers.Authorization = `Bearer ${SERVICE}`;
  return fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) } });
}

async function hmacHex(key: string, text: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

// Kashier: sort signatureKeys, "key=urlencoded(value)" joined with "&", HMAC-SHA256 hex.
// Their own code samples differ on how strictly values are encoded, so both forms are tried.
async function signatureOk(data: Record<string, unknown>, header: string | null) {
  if (!header || !API_KEY || !Array.isArray(data.signatureKeys)) return false;
  const keys = (data.signatureKeys as string[]).map(String).sort();
  const value = (k: string) => (data[k] === undefined || data[k] === null ? '' : String(data[k]));
  const loose = (v: string) => encodeURIComponent(v);
  const strict = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const want = header.trim().toLowerCase();
  for (const enc of [loose, strict]) {
    const text = keys.map(k => `${k}=${enc(value(k))}`).join('&');
    if (await hmacHex(API_KEY, text) === want) return true;
  }
  return false;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(await req.text()); } catch { return new Response('bad json', { status: 400 }); }
  const data = (body.data || {}) as Record<string, unknown>;
  const event = String(body.event || '');
  const status = String(data.status || '');
  const orderId = UUID.test(String(data.merchantOrderId || '')) ? String(data.merchantOrderId) : null;
  const valid = await signatureOk(data, req.headers.get('x-kashier-signature'));

  await db('payment_events', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, source: 'webhook', valid, status: `${event}:${status}`, amount: Number(data.amount) || null, payload: body }),
  });
  if (!valid) return new Response('bad signature', { status: 400 });
  if (!orderId) return new Response('ok');

  if ((event === 'pay' || event === 'capture') && status === 'SUCCESS') {
    const r = await db('rpc/store_mark_paid', {
      method: 'POST',
      body: JSON.stringify({
        p_order: orderId, p_amount: Number(data.amount), p_currency: String(data.currency || ''),
        p_transaction: data.transactionId ? String(data.transactionId) : null,
        p_kashier_order: data.kashierOrderId ? String(data.kashierOrderId) : null,
      }),
    });
    if (!r.ok) return new Response('db error', { status: 500 }); // Kashier tries again later
    // The site asks the buyer nothing, so the card holder's name (from Kashier) names the order.
    const holder = String((data.card as any)?.cardInfo?.cardHolderName || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
    if (holder) await db(`orders?id=eq.${orderId}&name=eq.`, { method: 'PATCH', body: JSON.stringify({ name: holder }) });
  } else if ((event === 'refund' || event === 'partial_refund' || event === 'void') && status === 'SUCCESS') {
    // Money went back to the buyer: the download closes.
    await db(`orders?id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: 'refunded', updated_at: new Date().toISOString() }) });
  }
  return new Response('ok');
});
