// Cloudflare Pages only: passes visitor requests on to the database under this address.
// It is also the backup route for the GitHub Pages address, for networks that block the
// database directly. Limited to what visitors use, so it can't serve as an open door.
const UPSTREAM = 'https://jyrcywuxqfandzerlrga.supabase.co';
const RPC = '/rest/v1/rpc/';
const FILES = '/storage/v1/object/public/media/';
const ALLOWED_RPC = new Set(['get_post', 'list_public_posts', 'register_view', 'unlock_post']);
const PASS_HEADERS = ['apikey', 'content-type', 'accept', 'range'];
const OTHER_SITES = ['https://abu-hanin1.github.io'];

function allowSite(request, headers) {
  const origin = request.headers.get('Origin');
  if (!OTHER_SITES.includes(origin)) return;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Expose-Headers', 'content-length, content-range, content-type');
}

export async function onRequest({ request, params }) {
  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'GET, HEAD, POST',
      'Access-Control-Allow-Headers': 'apikey, content-type, range',
      'Access-Control-Max-Age': '86400',
    });
    allowSite(request, headers);
    return new Response(null, { status: 204, headers });
  }

  const path = `/${[].concat(params.path || []).join('/')}`;
  const isRpc = request.method === 'POST' && path.startsWith(RPC) && ALLOWED_RPC.has(path.slice(RPC.length));
  const isFile = ['GET', 'HEAD'].includes(request.method) && path.startsWith(FILES);
  if (!isRpc && !isFile) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  PASS_HEADERS.forEach(name => {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  });
  const upstream = await fetch(UPSTREAM + path + new URL(request.url).search, {
    method: request.method,
    headers,
    body: isRpc ? request.body : undefined,
  });
  const res = new Response(upstream.body, upstream);
  allowSite(request, res.headers);
  return res;
}
