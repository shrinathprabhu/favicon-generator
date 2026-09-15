// Cloudflare Worker entry. Static files are served straight from ./public;
// only /api/* requests reach this script (see run_worker_first in wrangler.jsonc).
import { handleMetaApi } from './meta-fetch.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/meta') {
      return handleMetaApi(request, { allowPrivate: false });
    }

    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_found', message: 'Unknown API route.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
