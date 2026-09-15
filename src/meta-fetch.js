// Fetches the <head> of a web page for the meta tags tool. Uses only the
// fetch/streams APIs so the same code runs in the Cloudflare Worker and in the
// local Express GUI (Node 18+).

const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; FavigenMetaPreview/1.0; +https://favigen.lowkey.tools/meta-tags/)';

export class MetaFetchError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function handleMetaApi(request, { allowPrivate = false } = {}) {
  if (request.method !== 'GET') {
    return json({ error: 'method_not_allowed', message: 'Use GET.' }, 405);
  }

  const target = new URL(request.url).searchParams.get('url');

  try {
    const result = await fetchPageHead(target, { allowPrivate });
    return json(result, 200);
  } catch (error) {
    if (error instanceof MetaFetchError) {
      return json({ error: error.code, message: error.message }, error.status);
    }

    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return json({
      error: timedOut ? 'timeout' : 'fetch_failed',
      message: timedOut ? 'The page took too long to respond.' : `Could not reach the page${error?.message ? `: ${error.message}` : '.'}`
    }, 502);
  }
}

export async function fetchPageHead(target, { allowPrivate = false } = {}) {
  let url = parseTarget(target, allowPrivate);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let response;

  for (let hop = 0; ; hop += 1) {
    response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.8'
      }
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) {
        throw new MetaFetchError('too_many_redirects', 'The page redirected too many times.', 502);
      }

      response.body?.cancel().catch(() => {});
      url = parseTarget(new URL(location, url).href, allowPrivate);
      continue;
    }

    break;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/html|xml/i.test(contentType)) {
    response.body?.cancel().catch(() => {});
    throw new MetaFetchError('not_html', `Expected an HTML page but got "${contentType.split(';')[0]}".`, 422);
  }

  const { html, truncated } = await readHead(response, contentType);

  return {
    requestedUrl: String(target),
    finalUrl: url.href,
    status: response.status,
    contentType,
    truncated,
    html
  };
}

function parseTarget(value, allowPrivate) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new MetaFetchError('invalid_url', 'Enter a valid http or https URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MetaFetchError('invalid_url', 'Only http and https URLs can be fetched.');
  }

  if (url.username || url.password) {
    throw new MetaFetchError('invalid_url', 'URLs with credentials are not supported.');
  }

  if (!allowPrivate && isPrivateHost(url.hostname)) {
    throw new MetaFetchError('private_host', 'Local and private network addresses cannot be fetched from the server.', 422);
  }

  return url;
}

async function readHead(response, contentType) {
  if (!response.body) {
    return { html: '', truncated: false };
  }

  const decoder = createDecoder(contentType);
  const reader = response.body.getReader();
  let html = '';
  let bytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      html += decoder.decode();
      break;
    }

    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });

    // Everything the tool needs lives in <head>, so stop as soon as it closes.
    const headEnd = html.search(/<\/head\s*>/i);
    if (headEnd !== -1) {
      html = html.slice(0, headEnd) + '</head></html>';
      reader.cancel().catch(() => {});
      break;
    }

    if (bytes >= MAX_BYTES) {
      truncated = true;
      reader.cancel().catch(() => {});
      break;
    }
  }

  return { html, truncated };
}

function createDecoder(contentType) {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset || 'utf-8');
  } catch {
    return new TextDecoder('utf-8');
  }
}

export function isPrivateHost(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) {
    return true;
  }

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }

  if (host.includes(':')) {
    return host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:');
  }

  return false;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}
