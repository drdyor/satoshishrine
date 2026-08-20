// Preview gate: public hero at "/", everything else behind HTTP Basic Auth.
// Password lives in the SHRINE_GATE env var (Vercel project settings) — never in this
// public repo. Remove this file (and preview.html) to open the site fully.
export const config = { matcher: '/:path*' };

const PUBLIC_PATHS = new Set(['/preview', '/preview.html', '/robots.txt', '/favicon.ico',
  '/sitemap.xml']);
// The weekly archive stays public for crawlers: it is digest/marketing content with
// hash-stamped register diffs — the data product itself remains gated.
const PUBLIC_PREFIXES = ['/week'];

function authed(request) {
  const expected = process.env.SHRINE_GATE || '';
  if (!expected) return false; // fail closed if the env var is missing
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = atob(header.slice(6)); } catch { return false; }
  return decoded.slice(decoded.indexOf(':') + 1) === expected;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (authed(request)) {
    if (path === '/unlock') return Response.redirect(new URL('/', url), 302);
    return; // full site
  }
  if (PUBLIC_PATHS.has(path)) return;
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return;
  if (path === '/') {
    return new Response(null, {
      headers: { 'x-middleware-rewrite': new URL('/preview', url).toString() },
    });
  }
  return new Response('SatoshiShrine private preview. Enter any username and the access password.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SatoshiShrine preview"',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
