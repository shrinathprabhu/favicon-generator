// Meta Tags: fetch a page's <head>, edit its SEO/Open Graph/X tags, preview
// them on common platforms, validate lengths, and generate code to paste.

const FIELDS = ['title', 'description', 'canonical', 'favicon', 'appleTouchIcon', 'themeColor', 'ogTitle', 'ogDescription', 'ogImage', 'ogImageAlt', 'ogSiteName', 'ogType', 'ogUrl', 'twitterCard', 'twitterSite', 'twitterCreator', 'twitterTitle', 'twitterDescription', 'twitterImage'];

// min: shorter than this looks thin. max: the recommended ceiling. hard: platforms cut it off.
// px: rendered width Google allows before truncating (Arial at the size Google uses).
const LIMITS = {
  title: { min: 30, max: 60, hard: 70, px: 580, font: '20px Arial' },
  description: { min: 70, max: 160, hard: 200, px: 920, font: '14px Arial' },
  ogTitle: { min: 15, max: 60, hard: 90 },
  ogDescription: { min: 50, max: 160, hard: 200 },
  twitterTitle: { min: 15, max: 70, hard: 70 },
  twitterDescription: { min: 50, max: 200, hard: 200 },
  ogImageAlt: { min: 10, max: 420, hard: 420 }
};

const SAMPLE = {
  title: 'Meta Tags - Preview, edit, and generate SEO tags',
  description: 'See how your link looks on Google, X, Facebook, LinkedIn, and Slack. Edit the title, description, and image, then copy ready-to-paste tags.',
  canonical: 'https://favigen.lowkey.tools/meta-tags/',
  favicon: 'https://favigen.lowkey.tools/favicon.svg',
  appleTouchIcon: 'https://favigen.lowkey.tools/apple-touch-icon.png',
  themeColor: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: 'https://favigen.lowkey.tools/og-image.png',
  ogImageAlt: 'Favicon Generator - tools for favicons, OG images, and meta tags.',
  ogSiteName: 'Favigen',
  ogType: 'website',
  ogUrl: '',
  twitterCard: 'summary_large_image',
  twitterSite: '@shrinath_prabhu',
  twitterCreator: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: ''
};

const state = { ...SAMPLE };
let source = null;
let pageUrl = 'https://favigen.lowkey.tools/meta-tags/';
const imageProbes = new Map();

const $ = (selector) => document.querySelector(selector);
const metaForm = $('#meta-form');
const fetchForm = $('#fetch-form');
const urlInput = $('#page-url');
const fetchButton = $('#fetch-button');
const fetchStatus = $('#fetch-status');
const measureCtx = document.createElement('canvas').getContext('2d');
let updateQueued = false;

init();

function init() {
  syncEditor();
  update();

  metaForm.addEventListener('input', onEdit);
  metaForm.addEventListener('change', onEdit);
  fetchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchPage();
  });

  $('#toggle-paste').addEventListener('click', () => togglePaste());
  document.querySelectorAll('[data-open-paste]').forEach((button) => button.addEventListener('click', () => togglePaste(true)));
  $('#paste-analyze').addEventListener('click', analyzePasted);

  document.querySelectorAll('input[name="codeFormat"]').forEach((input) => input.addEventListener('change', renderCode));
  $('#explicit-x').addEventListener('change', renderCode);
  $('#copy-code').addEventListener('click', copyCode);

  setupBookmarklet();

  const initialUrl = new URLSearchParams(location.search).get('url');
  if (initialUrl) {
    urlInput.value = initialUrl;
    fetchPage();
  }
}

/* ---------- editing ---------- */

function onEdit(event) {
  const { name, value, type, checked } = event.target;
  if (!FIELDS.includes(name)) return;
  if (type === 'radio' && !checked) return;
  if (state[name] === value) return;
  state[name] = value;
  scheduleUpdate();
}

function scheduleUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  requestAnimationFrame(() => {
    updateQueued = false;
    update();
  });
}

function syncEditor() {
  for (const key of FIELDS) {
    metaForm.querySelectorAll(`[name="${key}"]`).forEach((input) => {
      if (input.type === 'radio') input.checked = input.value === state[key];
      else input.value = state[key];
    });
  }
}

function effective() {
  const ogTitle = state.ogTitle.trim() || state.title.trim();
  const ogDescription = state.ogDescription.trim() || state.description.trim();
  const ogImage = state.ogImage.trim();
  const url = state.ogUrl.trim() || state.canonical.trim() || pageUrl;
  return {
    title: state.title.trim(),
    description: state.description.trim(),
    canonical: state.canonical.trim(),
    favicon: state.favicon.trim(),
    appleTouchIcon: state.appleTouchIcon.trim(),
    themeColor: state.themeColor.trim(),
    ogTitle,
    ogDescription,
    ogImage,
    ogImageAlt: state.ogImageAlt.trim(),
    ogSiteName: state.ogSiteName.trim(),
    ogType: state.ogType || 'website',
    ogUrl: url,
    twitterCard: state.twitterCard || 'summary_large_image',
    twitterSite: normalizeHandle(state.twitterSite),
    twitterCreator: normalizeHandle(state.twitterCreator),
    twitterTitle: state.twitterTitle.trim() || ogTitle,
    twitterDescription: state.twitterDescription.trim() || ogDescription,
    twitterImage: state.twitterImage.trim() || ogImage
  };
}

function normalizeHandle(value) {
  const handle = String(value).trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '').replace(/\/.*$/, '');
  if (!handle) return '';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function update() {
  const eff = effective();
  updatePlaceholders(eff);
  updateCounters();
  renderPreviews(eff);
  renderFavicon(eff);
  renderChecks(eff);
  renderCoverage(eff);
  renderCode();
}

function updatePlaceholders(eff) {
  const placeholders = {
    ogTitle: eff.title ? `Uses title: ${eff.title}` : '',
    ogDescription: eff.description ? `Uses description: ${eff.description}` : '',
    ogUrl: state.canonical.trim() || pageUrl,
    ogSiteName: hostOf(eff.ogUrl),
    twitterTitle: eff.ogTitle ? `Uses og:title: ${eff.ogTitle}` : '',
    twitterDescription: eff.ogDescription ? `Uses og:description: ${eff.ogDescription}` : '',
    twitterImage: eff.ogImage ? `Uses og:image` : 'https://example.com/og.png',
    title: 'Page title',
    description: 'A short summary of the page'
  };
  for (const [key, text] of Object.entries(placeholders)) {
    const input = metaForm.querySelector(`[name="${key}"]`);
    if (input) input.placeholder = text;
  }
}

function measureText(text, font) {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

function lengthTone(key, value) {
  const limit = LIMITS[key];
  const length = [...value].length;
  if (!length) return '';
  if (length > limit.hard) return 'bad';
  if (length < limit.min || length > limit.max) return 'warn';
  if (limit.px && measureText(value, limit.font) > limit.px) return 'warn';
  return 'ok';
}

function updateCounters() {
  for (const [key, limit] of Object.entries(LIMITS)) {
    const counter = metaForm.querySelector(`[data-counter="${key}"]`);
    const meter = metaForm.querySelector(`[data-meter="${key}"]`);
    const value = state[key].trim();
    const length = [...value].length;
    const tone = lengthTone(key, value);

    let label = length ? `${length} / ${limit.max}` : (key.startsWith('og') || key.startsWith('twitter')) && key !== 'ogImageAlt' ? 'inherits' : '0';
    if (limit.px && length) {
      label += ` · ${Math.round(measureText(value, limit.font))} / ${limit.px}px`;
    }

    if (counter) {
      counter.textContent = label;
      counter.dataset.tone = tone;
    }

    if (meter) {
      meter.dataset.tone = tone;
      meter.firstElementChild.style.transform = `scaleX(${Math.min(1, length / limit.hard)})`;
    }
  }
}

/* ---------- fetching ---------- */

function isPrivateHost(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return host === '::1' || /^f[cd]|^fe[89ab]/.test(host);
}

function parseInputUrl(raw) {
  let value = raw.trim();
  if (!value) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const host = value.split(/[/?#]/)[0].replace(/:\d+$/, '');
    value = `${isPrivateHost(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) ? 'http' : 'https'}://${value}`;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function setFetchStatus(message, tone = '') {
  fetchStatus.textContent = message;
  fetchStatus.dataset.tone = tone;
}

async function fetchPage() {
  const url = parseInputUrl(urlInput.value);
  $('#local-help').hidden = true;

  if (!url) {
    setFetchStatus('Enter a valid http or https URL.', 'error');
    urlInput.focus();
    return;
  }

  urlInput.value = url.href;
  fetchButton.disabled = true;
  setFetchStatus(`Fetching ${url.href}…`);

  const isPrivate = isPrivateHost(url.hostname);
  let serverMessage = '';

  try {
    // 1. The server-side fetcher (Cloudflare Worker, or the local GUI which can also reach localhost).
    try {
      const response = await fetch(`/api/meta?url=${encodeURIComponent(url.href)}`, { headers: { Accept: 'application/json' } });
      if ((response.headers.get('content-type') || '').includes('application/json')) {
        const data = await response.json();
        if (response.ok && typeof data.html === 'string') {
          loadSource(data.html, data.finalUrl || url.href, data.status >= 400 ? `Fetched with HTTP ${data.status}.` : '');
          return;
        }
        if (data.error !== 'private_host') serverMessage = data.message || '';
      }
    } catch {
      // No API available (for example a plain static host). Try the browser next.
    }

    // 2. Straight from the browser. Works when the site (or dev server) allows CORS.
    try {
      const response = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
      const html = await response.text();
      loadSource(html, response.url || url.href, response.ok ? '' : `Fetched with HTTP ${response.status}.`);
      return;
    } catch {
      // Blocked by CORS, mixed content, or the network.
    }

    if (isPrivate) {
      $('#local-help-url').textContent = url.origin;
      $('#paste-base').value = url.href;
      $('#local-help').hidden = false;
      setFetchStatus('');
    } else {
      setFetchStatus(serverMessage || 'Could not fetch that page. Check the URL, or paste the HTML instead.', 'error');
    }
  } finally {
    fetchButton.disabled = false;
  }
}

function togglePaste(force) {
  const panel = $('#paste-panel');
  panel.hidden = force === undefined ? !panel.hidden : !force;
  if (!panel.hidden) {
    if (!$('#paste-base').value && urlInput.value) $('#paste-base').value = urlInput.value;
    $('#paste-html').focus();
  }
}

function analyzePasted() {
  const html = $('#paste-html').value;
  if (!html.trim()) {
    setFetchStatus('Paste some HTML first.', 'error');
    return;
  }
  const base = parseInputUrl($('#paste-base').value);
  if (base) urlInput.value = base.href;
  loadSource(html, base?.href || '', base ? '' : 'No page URL given, so relative links stay relative.');
  $('#paste-panel').hidden = true;
  $('#local-help').hidden = true;
}

function setupBookmarklet() {
  const link = $('#bookmarklet');
  const origin = location.origin;
  const code = `(()=>{const o=${JSON.stringify(origin)};const w=window.open(o+'/meta-tags/#bookmarklet','_blank');if(!w){alert('Allow pop-ups to send this page to Meta Tags.');return}const d=document;const p={type:'favigen-meta',url:location.href,html:'<html lang="'+(d.documentElement.lang||'').replace(/"/g,'')+'">'+d.head.outerHTML+'</html>'};const t=setInterval(()=>w.postMessage(p,o),250);addEventListener('message',e=>{if(e.origin===o&&e.data==='favigen-meta-ack')clearInterval(t)});setTimeout(()=>clearInterval(t),20000)})()`;
  link.href = `javascript:${encodeURIComponent(code)}`;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setFetchStatus('Drag the "Send to Meta Tags" link to your bookmarks bar, then click it on your local page.');
  });

  if (location.hash !== '#bookmarklet') return;

  setFetchStatus('Waiting for your page…');
  let received = false;
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'favigen-meta' || typeof data.html !== 'string') return;
    event.source?.postMessage('favigen-meta-ack', '*');
    if (received) return;
    received = true;
    history.replaceState(null, '', location.pathname);
    urlInput.value = String(data.url || '');
    loadSource(data.html.slice(0, 2_000_000), String(data.url || ''), 'Read from the live page, including tags added by JavaScript.');
  });
}

/* ---------- parsing ---------- */

function loadSource(html, baseHref, note = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let base = safeUrl(baseHref);
  const baseTag = doc.querySelector('base[href]')?.getAttribute('href');
  if (baseTag) base = safeUrl(baseTag, base) || base;

  const resolve = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return base ? safeUrl(trimmed, base)?.href || trimmed : trimmed;
  };

  const metas = [...doc.querySelectorAll('meta')].map((meta) => ({
    key: (meta.getAttribute('property') || meta.getAttribute('name') || meta.getAttribute('itemprop') || meta.getAttribute('http-equiv') || (meta.hasAttribute('charset') ? 'charset' : '')).trim(),
    value: (meta.getAttribute('content') ?? meta.getAttribute('charset') ?? '').trim()
  })).filter((meta) => meta.key);

  const get = (...keys) => {
    for (const key of keys) {
      const found = metas.find((meta) => meta.key.toLowerCase() === key && meta.value);
      if (found) return found.value;
    }
    return '';
  };

  const links = [...doc.querySelectorAll('link[rel][href]')].map((link) => ({
    rel: link.getAttribute('rel').toLowerCase().split(/\s+/),
    href: link.getAttribute('href'),
    type: link.getAttribute('type') || '',
    sizes: link.getAttribute('sizes') || ''
  }));
  links.forEach((link) => { link.url = resolve(link.href); });
  const icons = links.filter((link) => link.rel.includes('icon'));
  const icon = icons.find((link) => link.type === 'image/svg+xml') || icons.find((link) => /32|48|any/.test(link.sizes)) || icons[0];
  const appleIcon = links.find((link) => link.rel.includes('apple-touch-icon') || link.rel.includes('apple-touch-icon-precomposed'));

  source = {
    title: doc.querySelector('title')?.textContent.trim() || '',
    metas,
    links,
    lang: doc.documentElement.getAttribute('lang') || '',
    hasViewport: Boolean(get('viewport')),
    hasCharset: metas.some((meta) => meta.key === 'charset' || /charset/i.test(meta.value)),
    hasIcon: Boolean(icon),
    faviconFallback: !icon && Boolean(base),
    base: base?.href || ''
  };

  Object.assign(state, {
    title: source.title,
    description: get('description'),
    canonical: resolve(links.find((link) => link.rel.includes('canonical'))?.href),
    favicon: icon ? resolve(icon.href) : base ? new URL('/favicon.ico', base).href : '',
    appleTouchIcon: appleIcon ? resolve(appleIcon.href) : '',
    themeColor: get('theme-color'),
    ogTitle: get('og:title'),
    ogDescription: get('og:description'),
    ogImage: resolve(get('og:image', 'og:image:url', 'og:image:secure_url')),
    ogImageAlt: get('og:image:alt'),
    ogSiteName: get('og:site_name'),
    ogType: get('og:type') || 'website',
    ogUrl: resolve(get('og:url')),
    twitterCard: get('twitter:card') === 'summary' ? 'summary' : 'summary_large_image',
    twitterSite: get('twitter:site'),
    twitterCreator: get('twitter:creator'),
    twitterTitle: get('twitter:title'),
    twitterDescription: get('twitter:description'),
    twitterImage: resolve(get('twitter:image', 'twitter:image:src'))
  });

  if (!metaForm.querySelector(`#f-ogType option[value="${CSS.escape(state.ogType)}"]`)) {
    $('#f-ogType').append(new Option(state.ogType, state.ogType));
  }

  pageUrl = base?.href || '';
  renderRawTags();
  syncEditor();
  update();

  const count = metas.length;
  setFetchStatus(`Found ${count} meta tag${count === 1 ? '' : 's'}${source.title ? ' and a title' : ''}. ${note}`.trim());
  $('#local-help').hidden = true;
}

function safeUrl(value, base) {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function hostOf(value) {
  return safeUrl(value)?.hostname.replace(/^www\./, '') || '';
}

function renderRawTags() {
  const body = $('#raw-body');
  body.replaceChildren();
  const rows = [];
  if (source.title) rows.push(['<title>', source.title]);
  for (const meta of source.metas) rows.push([meta.key, meta.value]);
  for (const link of source.links) rows.push([`link rel="${link.rel.join(' ')}"`, link.href]);

  for (const [key, value] of rows) {
    body.append(h('tr', {}, h('td', {}, key), h('td', {}, value)));
  }
  $('#raw-count').textContent = String(rows.length);
  $('#raw-tags').hidden = rows.length === 0;
}

/* ---------- image probing ---------- */

function probeImage(url) {
  if (!url) return null;
  let probe = imageProbes.get(url);
  if (probe) return probe;

  probe = { status: 'loading', width: 0, height: 0 };
  imageProbes.set(url, probe);

  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload = () => {
    Object.assign(probe, { status: 'ok', width: img.naturalWidth, height: img.naturalHeight });
    if (isInUse(url)) scheduleUpdate();
  };
  img.onerror = () => {
    probe.status = 'error';
    if (isInUse(url)) scheduleUpdate();
  };
  img.src = url;
  return probe;
}

// The editor guesses /favicon.ico when a page declares no icon. Only keep that
// guess in the generated code if the file actually exists.
function codeFavicon(eff) {
  if (!eff.favicon) return '';
  const guessed = source?.faviconFallback && state.favicon.trim() === new URL('/favicon.ico', source.base).href;
  return guessed && imageProbes.get(eff.favicon)?.status === 'error' ? '' : eff.favicon;
}

function isInUse(url) {
  const eff = effective();
  return [eff.ogImage, eff.twitterImage, eff.favicon, eff.appleTouchIcon].includes(url) || Boolean(source?.links.some((link) => link.url === url));
}

/* ---------- previews ---------- */

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

function imageBox(url, extraClass = '') {
  const box = h('div', { class: `pv-image ${extraClass}`.trim() });
  if (!url) {
    box.append('No image');
    return box;
  }

  const probe = probeImage(url);
  if (probe?.status === 'error') {
    box.append('Image failed to load');
    return box;
  }

  box.append(h('img', { src: url, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }));
  return box;
}

function truncateToWidth(text, font, maxWidth) {
  if (measureText(text, font) <= maxWidth) return text;
  const characters = [...text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measureText(`${characters.slice(0, middle).join('')} ...`, font) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join('').trimEnd()} ...`;
}

function renderPreviews(eff) {
  const container = $('#previews');
  const url = safeUrl(eff.canonical || eff.ogUrl);
  const domain = url?.hostname.replace(/^www\./, '') || 'example.com';
  const siteName = eff.ogSiteName || domain;
  const breadcrumb = url ? [url.origin, ...url.pathname.split('/').filter(Boolean)].join(' › ') : 'https://example.com';
  const titleFallback = 'Add a title';
  const favicon = eff.favicon ? iconImage(eff.favicon, 16) : null;

  const google = card('Google',
    h('div', { class: 'pv-google' },
      h('div', { class: 'pv-google-site' },
        h('span', { class: 'pv-google-icon' }, eff.favicon ? iconImage(eff.favicon, 18) : null),
        h('span', {}, h('div', { class: 'pv-google-name' }, siteName), h('div', { class: 'pv-google-url' }, breadcrumb))
      ),
      h('h3', { class: 'pv-google-title' }, truncateToWidth(eff.title || titleFallback, LIMITS.title.font, LIMITS.title.px)),
      h('div', { class: 'pv-google-desc' }, truncateToWidth(eff.description || 'Google may pull text from the page when there is no description.', LIMITS.description.font, LIMITS.description.px))
    )
  );

  const facebook = card('Facebook',
    h('div', { class: 'pv-facebook' },
      imageBox(eff.ogImage),
      h('div', { class: 'pv-facebook-body' },
        h('div', { class: 'pv-facebook-domain' }, domain),
        h('div', { class: 'pv-facebook-title pv-clamp-2' }, eff.ogTitle || titleFallback),
        h('div', { class: 'pv-facebook-desc pv-clamp-1' }, eff.ogDescription)
      )
    )
  );

  const large = eff.twitterCard !== 'summary';
  const xCard = large
    ? h('div', {},
      h('div', { class: 'pv-x' }, imageBox(eff.twitterImage), h('span', { class: 'pv-x-tag' }, eff.twitterTitle || titleFallback)),
      h('div', { class: 'pv-x-from' }, `From ${domain}`))
    : h('div', { class: 'pv-x' },
      h('div', { class: 'pv-x-summary' },
        imageBox(eff.twitterImage),
        h('div', { class: 'pv-x-summary-body' },
          h('div', { class: 'pv-x-domain' }, domain),
          h('div', { class: 'pv-x-title pv-clamp-1' }, eff.twitterTitle || titleFallback),
          h('div', { class: 'pv-x-desc pv-clamp-2' }, eff.twitterDescription)
        )
      ));
  const x = card('X', xCard);

  const linkedin = card('LinkedIn',
    h('div', { class: 'pv-linkedin' },
      imageBox(eff.ogImage),
      h('div', { class: 'pv-linkedin-body' },
        h('div', { class: 'pv-linkedin-title pv-clamp-2' }, eff.ogTitle || titleFallback),
        h('div', { class: 'pv-linkedin-domain' }, domain)
      )
    )
  );

  const slack = card('Slack',
    h('div', { class: 'pv-slack-wrap' },
      h('div', { class: 'pv-slack' },
        h('div', { class: 'pv-slack-site' }, favicon, siteName),
        h('div', { class: 'pv-slack-title' }, eff.ogTitle || titleFallback),
        eff.ogDescription ? h('div', { class: 'pv-clamp-2' }, eff.ogDescription) : null,
        eff.ogImage ? imageBox(eff.ogImage) : null
      )
    )
  );

  container.replaceChildren(google, x, facebook, linkedin, slack);
}

function card(label, content) {
  return h('article', { class: 'preview-card' }, h('div', { class: 'preview-label' }, label), content);
}

/* ---------- checks ---------- */

function renderChecks(eff) {
  const checks = [];
  const add = (tone, text) => checks.push({ tone, text });

  lengthCheck(add, 'Title', eff.title, 'title', true);
  if (eff.title && measureText(eff.title, LIMITS.title.font) > LIMITS.title.px) {
    add('warn', `Title is about ${Math.round(measureText(eff.title, LIMITS.title.font))}px wide. Google cuts titles off around ${LIMITS.title.px}px.`);
  }
  lengthCheck(add, 'Description', eff.description, 'description', true);

  if (!eff.canonical) add('warn', 'No canonical URL. Add one so search engines know the preferred address for this page.');
  else if (!/^https?:\/\//i.test(eff.canonical)) add('bad', 'Canonical URL should be absolute, starting with https://.');
  else add('ok', 'Canonical URL is set.');

  if (state.ogTitle.trim()) lengthCheck(add, 'og:title', state.ogTitle.trim(), 'ogTitle', false);
  if (state.ogDescription.trim()) lengthCheck(add, 'og:description', state.ogDescription.trim(), 'ogDescription', false);
  if (state.twitterTitle.trim()) lengthCheck(add, 'twitter:title', state.twitterTitle.trim(), 'twitterTitle', false);
  if (state.twitterDescription.trim()) lengthCheck(add, 'twitter:description', state.twitterDescription.trim(), 'twitterDescription', false);

  imageChecks(add, 'og:image', eff.ogImage, true);
  if (state.twitterImage.trim() && state.twitterImage.trim() !== eff.ogImage) imageChecks(add, 'twitter:image', eff.twitterImage, false);

  if (eff.ogImage && !eff.ogImageAlt) add('warn', 'Add og:image:alt so screen reader users know what the image shows.');
  if (!eff.ogSiteName) add('warn', 'No og:site_name. Some apps show it above the title.');
  if (!/^https?:\/\//i.test(eff.ogUrl)) add('warn', 'og:url should be an absolute URL. Add a canonical URL or og:url.');
  if (eff.themeColor && !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(eff.themeColor) && !CSS.supports('color', eff.themeColor)) {
    add('bad', `theme-color "${eff.themeColor}" is not a valid CSS color.`);
  }

  iconChecks(add, eff);

  const order = { bad: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => order[a.tone] - order[b.tone]);

  $('#checks').replaceChildren(...checks.map((check) => h('li', { 'data-tone': check.tone }, check.text)));

  const counts = { ok: 0, warn: 0, bad: 0 };
  checks.forEach((check) => { counts[check.tone] += 1; });
  $('#check-summary').replaceChildren(...[
    h('span', { 'data-tone': 'ok' }, `${counts.ok} passed`),
    counts.warn ? h('span', { 'data-tone': 'warn' }, `${counts.warn} to review`) : null,
    counts.bad ? h('span', { 'data-tone': 'bad' }, `${counts.bad} to fix`) : null
  ].filter(Boolean));
}

function iconChecks(add, eff) {
  if (!eff.favicon) {
    add('bad', 'No favicon. Browsers, bookmarks, and Google search results show it next to your page.');
  } else {
    const probe = probeImage(eff.favicon);
    const isSvg = /\.svg(\?|#|$)/i.test(eff.favicon);
    if (probe?.status === 'error') {
      add('bad', source?.faviconFallback
        ? 'No <link rel="icon"> on the page, and /favicon.ico does not exist.'
        : 'The favicon could not be loaded.');
    } else if (probe?.status === 'ok') {
      if (source?.faviconFallback) add('warn', 'No <link rel="icon"> on the page. Browsers found /favicon.ico by convention, but declare it explicitly.');
      if (!isSvg && probe.width !== probe.height) add('warn', `Favicon is ${probe.width}×${probe.height}. Icons should be square.`);
      else if (!isSvg && probe.width < 48) add('warn', `Favicon is ${probe.width}×${probe.height}. Google asks for at least 48×48.`);
      else add('ok', `Favicon loads${isSvg ? ' (SVG)' : ` (${probe.width}×${probe.height})`}.`);
    }
  }

  if (!eff.appleTouchIcon) {
    add('warn', 'No apple-touch-icon. iPhones and iPads will use a screenshot of the page on the home screen.');
  } else {
    const probe = probeImage(eff.appleTouchIcon);
    if (probe?.status === 'error') add('bad', 'The apple-touch-icon could not be loaded.');
    else if (probe?.status === 'ok' && (probe.width !== 180 || probe.height !== 180)) add('warn', `apple-touch-icon is ${probe.width}×${probe.height}. Use 180×180.`);
    else if (probe?.status === 'ok') add('ok', 'apple-touch-icon is 180×180.');
  }
}

/* ---------- tag checklist ---------- */

function renderCoverage(eff) {
  const hasMeta = (key) => (source ? source.metas.some((meta) => meta.key.toLowerCase() === key && meta.value) : null);
  const hasLink = (...rels) => (source ? source.links.some((link) => rels.some((rel) => link.rel.includes(rel))) : null);

  // page: is it in the fetched HTML (null when nothing was fetched).
  // set: will the generated code include it (null when this tool cannot add it).
  const items = [
    { tag: '<title>', level: 'required', page: source ? Boolean(source.title) : null, set: Boolean(eff.title) },
    { tag: 'meta description', level: 'required', page: hasMeta('description'), set: Boolean(eff.description) },
    { tag: 'meta charset', level: 'required', page: source ? source.hasCharset : null, set: null },
    { tag: 'meta viewport', level: 'required', page: source ? source.hasViewport : null, set: null },
    { tag: 'link rel="icon"', level: 'required', page: hasLink('icon'), set: Boolean(codeFavicon(eff)) },
    { tag: 'og:title', level: 'required', page: hasMeta('og:title'), set: Boolean(eff.ogTitle) },
    { tag: 'og:description', level: 'required', page: hasMeta('og:description'), set: Boolean(eff.ogDescription) },
    { tag: 'og:image', level: 'required', page: source ? ['og:image', 'og:image:url', 'og:image:secure_url'].some(hasMeta) : null, set: Boolean(eff.ogImage) },
    { tag: 'twitter:card', level: 'required', page: hasMeta('twitter:card'), set: true },
    { tag: 'html lang', level: 'recommended', page: source ? Boolean(source.lang) : null, set: null },
    { tag: 'link rel="canonical"', level: 'recommended', page: hasLink('canonical'), set: Boolean(eff.canonical) },
    { tag: 'apple-touch-icon', level: 'recommended', page: hasLink('apple-touch-icon', 'apple-touch-icon-precomposed'), set: Boolean(eff.appleTouchIcon) },
    { tag: 'og:url', level: 'recommended', page: hasMeta('og:url'), set: /^https?:\/\//i.test(eff.ogUrl) },
    { tag: 'og:type', level: 'recommended', page: hasMeta('og:type'), set: true },
    { tag: 'og:site_name', level: 'recommended', page: hasMeta('og:site_name'), set: Boolean(eff.ogSiteName) },
    { tag: 'og:image:alt', level: 'recommended', page: hasMeta('og:image:alt'), set: Boolean(eff.ogImage && eff.ogImageAlt) },
    { tag: 'theme-color', level: 'optional', page: hasMeta('theme-color'), set: Boolean(eff.themeColor) },
    { tag: 'link rel="manifest"', level: 'optional', page: hasLink('manifest'), set: null },
    { tag: 'twitter:site', level: 'optional', page: hasMeta('twitter:site'), set: Boolean(eff.twitterSite) }
  ];

  const rows = [];
  let present = 0;
  let missingRequired = 0;

  for (const item of items) {
    let tone;
    let status;

    if (item.page === true) {
      tone = 'ok';
      status = 'On the page';
    } else if (item.page === false) {
      if (item.set) {
        tone = 'warn';
        status = 'Missing · added in the code below';
      } else {
        tone = item.level === 'required' ? 'bad' : item.level === 'recommended' ? 'warn' : '';
        status = item.set === null ? 'Missing · add it to your page' : 'Missing · fill it in on the left';
      }
    } else if (item.set === null) {
      continue;
    } else if (item.set) {
      tone = 'ok';
      status = 'Set';
    } else {
      tone = item.level === 'required' ? 'bad' : item.level === 'recommended' ? 'warn' : '';
      status = 'Not set';
    }

    if (tone === 'ok') present += 1;
    if (tone === 'bad') missingRequired += 1;

    rows.push(h('li', { 'data-tone': tone },
      h('code', {}, item.tag),
      h('span', { class: `level level-${item.level}` }, item.level),
      h('span', { class: 'coverage-status' }, status)
    ));
  }

  $('#coverage').replaceChildren(...rows);
  $('#coverage-note').textContent = source
    ? 'Based on the HTML that was fetched. Tags filled in on the left are added to the code below.'
    : 'Fetch a page to check which tags it already has. Until then, this reflects the fields on the left.';
  $('#coverage-summary').replaceChildren(...[
    h('span', { 'data-tone': 'ok' }, `${present} of ${rows.length} present`),
    missingRequired ? h('span', { 'data-tone': 'bad' }, `${missingRequired} required missing`) : null
  ].filter(Boolean));
}

/* ---------- favicon preview ---------- */

function iconImage(url, size, className = '') {
  const probe = url ? probeImage(url) : null;
  if (!url || probe?.status === 'error') {
    return h('span', { class: `icon-missing ${className}`.trim(), title: url ? 'Could not load' : 'No icon' });
  }
  const img = h('img', { src: url, alt: '', width: size, height: size, referrerpolicy: 'no-referrer', class: className || null });
  return img;
}

function renderFavicon(eff) {
  const container = $('#favicon-preview');
  const url = safeUrl(eff.canonical || eff.ogUrl);
  const tabTitle = eff.title || url?.hostname || 'New Tab';
  const appName = eff.ogSiteName || url?.hostname.replace(/^www\./, '').split('.')[0] || 'App';

  const tab = (theme) => h('div', { class: `fv-browser fv-${theme}` },
    h('div', { class: 'fv-tabs' },
      h('div', { class: 'fv-tab fv-tab-active' }, iconImage(eff.favicon, 16, 'fv-tab-icon'), h('span', { class: 'fv-tab-title' }, tabTitle), h('span', { class: 'fv-tab-close', 'aria-hidden': 'true' }, '×')),
      h('div', { class: 'fv-tab' }, h('span', { class: 'fv-tab-dot' }), h('span', { class: 'fv-tab-title' }, 'Another tab'))
    ),
    h('div', { class: 'fv-address' }, url ? url.host + url.pathname : 'example.com')
  );

  const sizes = h('div', { class: 'fv-sizes' },
    ...['light', 'dark'].map((theme) => h('div', { class: `fv-size-row fv-${theme}` },
      ...[16, 32, 48].map((size) => h('figure', { class: 'fv-size' }, iconImage(eff.favicon, size), h('figcaption', {}, `${size}px`)))
    ))
  );

  const home = h('div', { class: 'fv-home' },
    h('div', { class: 'fv-home-app' },
      eff.appleTouchIcon
        ? iconImage(eff.appleTouchIcon, 60, 'fv-home-icon')
        : h('span', { class: 'fv-home-icon fv-home-fallback' }, 'No icon'),
      h('span', { class: 'fv-home-label' }, appName)
    )
  );

  const blocks = [
    card('Browser tabs', h('div', { class: 'fv-browsers' }, tab('light'), tab('dark'))),
    card('Small sizes', sizes),
    card('iOS home screen', home)
  ];

  const found = source ? source.links.filter((link) => link.rel.some((rel) => /icon|manifest/.test(rel))) : [];
  if (found.length) {
    blocks.push(card(`Icons on the page (${found.length})`, h('ul', { class: 'fv-list' },
      ...found.map((link) => {
        const isManifest = link.rel.includes('manifest');
        const probe = !isManifest && link.url ? probeImage(link.url) : null;
        const detail = [link.sizes && `sizes="${link.sizes}"`, link.type].filter(Boolean).join(' · ');
        const status = isManifest ? 'Web app manifest' : probe?.status === 'ok' ? `${probe.width}×${probe.height}` : probe?.status === 'error' ? 'Failed to load' : 'Loading…';
        return h('li', { 'data-tone': probe?.status === 'error' ? 'bad' : '' },
          isManifest ? h('span', { class: 'icon-missing fv-list-icon' }) : iconImage(link.url, 32, 'fv-list-icon'),
          h('span', { class: 'fv-list-text' }, h('code', {}, `rel="${link.rel.join(' ')}"`), detail ? h('span', { class: 'hint' }, detail) : null, h('span', { class: 'fv-list-url' }, link.url || link.href)),
          h('span', { class: 'fv-list-status' }, status)
        );
      })
    )));
  }

  container.replaceChildren(...blocks);
}

function lengthCheck(add, label, value, key, required) {
  const limit = LIMITS[key];
  const length = [...value].length;
  if (!length) {
    if (required) add('bad', `${label} is missing.`);
    return;
  }
  if (length > limit.hard) add('bad', `${label} is ${length} characters. Keep it under ${limit.max}; most platforms cut it off after ${limit.hard}.`);
  else if (length > limit.max) add('warn', `${label} is ${length} characters. Aim for ${limit.max} or fewer so it is not truncated.`);
  else if (length < limit.min) add('warn', `${label} is only ${length} characters. Aim for ${limit.min}–${limit.max} to use the space well.`);
  else add('ok', `${label} length is good (${length} characters).`);
}

function imageChecks(add, label, url, required) {
  if (!url) {
    if (required) add('bad', `${label} is missing, so shared links will show without a picture.`);
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    add('bad', `${label} must be an absolute URL. Crawlers cannot resolve relative paths.`);
    return;
  }
  if (/^http:\/\//i.test(url)) add('warn', `${label} uses http. Use https so every platform can load it.`);
  if (isPrivateHost(safeUrl(url)?.hostname || '')) add('warn', `${label} points to a local address. Social platforms cannot reach it once you deploy.`);

  const probe = probeImage(url);
  if (!probe || probe.status === 'loading') return;
  if (probe.status === 'error') {
    add('bad', `${label} could not be loaded.`);
    return;
  }

  const { width, height } = probe;
  const ratio = width / height;
  if (width < 200 || height < 200) add('bad', `${label} is ${width}×${height}. Facebook needs at least 200×200; 1200×630 is best.`);
  else if (width < 1200 || height < 630) add('warn', `${label} is ${width}×${height}. Use 1200×630 so it stays sharp on high-density screens.`);
  else add('ok', `${label} is ${width}×${height}.`);

  if (Math.abs(ratio - 1.91) / 1.91 > 0.06 && state.twitterCard !== 'summary') {
    add('warn', `${label} has a ${ratio.toFixed(2)}:1 aspect ratio. Large cards use 1.91:1, so it will be cropped.`);
  }
}

/* ---------- code generation ---------- */

function renderCode() {
  const eff = effective();
  const format = document.querySelector('input[name="codeFormat"]:checked')?.value || 'html';
  const code = format === 'next' ? nextCode(eff) : htmlCode(eff);
  const pre = $('#code');
  pre.dataset.raw = code;
  pre.replaceChildren(...highlight(code, format));
}

function imageSize(url) {
  const probe = url ? imageProbes.get(url) : null;
  return probe?.status === 'ok' ? probe : null;
}

function xOverrides(eff) {
  const explicit = $('#explicit-x').checked;
  return {
    title: explicit || state.twitterTitle.trim() ? eff.twitterTitle : '',
    description: explicit || state.twitterDescription.trim() ? eff.twitterDescription : '',
    image: explicit || state.twitterImage.trim() ? eff.twitterImage : ''
  };
}

function htmlCode(eff) {
  const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const meta = (kind, key, value) => (value ? `<meta ${kind}="${key}" content="${attr(value)}">` : null);
  const size = imageSize(eff.ogImage);
  const x = xOverrides(eff);

  const groups = [
    ['<!-- Primary meta tags -->', [
      eff.title ? `<title>${attr(eff.title)}</title>` : null,
      meta('name', 'description', eff.description),
      eff.canonical ? `<link rel="canonical" href="${attr(eff.canonical)}">` : null,
      codeFavicon(eff) ? `<link rel="icon" href="${attr(codeFavicon(eff))}">` : null,
      eff.appleTouchIcon ? `<link rel="apple-touch-icon" href="${attr(eff.appleTouchIcon)}">` : null,
      meta('name', 'theme-color', eff.themeColor)
    ]],
    ['<!-- Open Graph -->', [
      meta('property', 'og:type', eff.ogType),
      /^https?:\/\//i.test(eff.ogUrl) ? meta('property', 'og:url', eff.ogUrl) : null,
      meta('property', 'og:site_name', eff.ogSiteName),
      meta('property', 'og:title', eff.ogTitle),
      meta('property', 'og:description', eff.ogDescription),
      meta('property', 'og:image', eff.ogImage),
      size ? meta('property', 'og:image:width', size.width) : null,
      size ? meta('property', 'og:image:height', size.height) : null,
      meta('property', 'og:image:alt', eff.ogImage && eff.ogImageAlt)
    ]],
    ['<!-- X (Twitter) -->', [
      meta('name', 'twitter:card', eff.twitterCard),
      meta('name', 'twitter:site', eff.twitterSite),
      meta('name', 'twitter:creator', eff.twitterCreator),
      meta('name', 'twitter:title', x.title),
      meta('name', 'twitter:description', x.description),
      meta('name', 'twitter:image', x.image),
      x.image && eff.ogImageAlt ? meta('name', 'twitter:image:alt', eff.ogImageAlt) : null
    ]]
  ];

  return groups
    .map(([comment, lines]) => [comment, ...lines.filter(Boolean)])
    .filter((lines) => lines.length > 1)
    .map((lines) => lines.join('\n'))
    .join('\n\n') + '\n';
}

function nextCode(eff) {
  const str = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const size = imageSize(eff.ogImage);
  const x = xOverrides(eff);
  const lines = [`import type { Metadata${eff.themeColor ? ', Viewport' : ''} } from 'next';`, '', 'export const metadata: Metadata = {'];
  const push = (indent, text) => lines.push(`${'  '.repeat(indent)}${text}`);

  if (eff.title) push(1, `title: ${str(eff.title)},`);
  if (eff.description) push(1, `description: ${str(eff.description)},`);
  if (eff.canonical) push(1, `alternates: { canonical: ${str(eff.canonical)} },`);
  if (codeFavicon(eff) || eff.appleTouchIcon) {
    const icons = [codeFavicon(eff) && `icon: ${str(codeFavicon(eff))}`, eff.appleTouchIcon && `apple: ${str(eff.appleTouchIcon)}`].filter(Boolean);
    push(1, `icons: { ${icons.join(', ')} },`);
  }

  push(1, 'openGraph: {');
  // Next.js only accepts these Open Graph types.
  const nextTypes = /^(website|article|book|profile|music\.(song|album|playlist|radio_station)|video\.(movie|episode|tv_show|other))$/;
  push(2, `type: ${str(nextTypes.test(eff.ogType) ? eff.ogType : 'website')},`);
  if (/^https?:\/\//i.test(eff.ogUrl)) push(2, `url: ${str(eff.ogUrl)},`);
  if (eff.ogSiteName) push(2, `siteName: ${str(eff.ogSiteName)},`);
  if (eff.ogTitle) push(2, `title: ${str(eff.ogTitle)},`);
  if (eff.ogDescription) push(2, `description: ${str(eff.ogDescription)},`);
  if (eff.ogImage) {
    const parts = [`url: ${str(eff.ogImage)}`];
    if (size) parts.push(`width: ${size.width}`, `height: ${size.height}`);
    if (eff.ogImageAlt) parts.push(`alt: ${str(eff.ogImageAlt)}`);
    push(2, `images: [{ ${parts.join(', ')} }],`);
  }
  push(1, '},');

  push(1, 'twitter: {');
  push(2, `card: ${str(eff.twitterCard)},`);
  if (eff.twitterSite) push(2, `site: ${str(eff.twitterSite)},`);
  if (eff.twitterCreator) push(2, `creator: ${str(eff.twitterCreator)},`);
  if (x.title) push(2, `title: ${str(x.title)},`);
  if (x.description) push(2, `description: ${str(x.description)},`);
  if (x.image) push(2, `images: [${str(x.image)}],`);
  push(1, '},');
  lines.push('};');

  if (eff.themeColor) {
    lines.push('', 'export const viewport: Viewport = {', `  themeColor: ${str(eff.themeColor)},`, '};');
  }

  return `${lines.join('\n')}\n`;
}

function highlight(code, format) {
  const pattern = format === 'next'
    ? /(\/\/.*$)|('(?:\\.|[^'\\])*')|\b(import|export|const|type|from|new)\b|([A-Za-z_]\w*)(?=:)/gm
    : /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w:-]*|\/?>)|("[^"]*")|(\s[\w:-]+)(?==)/g;
  const classes = format === 'next'
    ? ['tk-comment', 'tk-string', 'tk-tag', 'tk-attr']
    : ['tk-comment', 'tk-tag', 'tk-string', 'tk-attr'];

  const nodes = [];
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    if (match.index > last) nodes.push(document.createTextNode(code.slice(last, match.index)));
    const group = match.slice(1).findIndex((value) => value !== undefined);
    nodes.push(h('span', { class: classes[group] }, match[0]));
    last = match.index + match[0].length;
  }
  if (last < code.length) nodes.push(document.createTextNode(code.slice(last)));
  return nodes;
}

async function copyCode() {
  const button = $('#copy-code');
  try {
    await navigator.clipboard.writeText($('#code').dataset.raw || '');
    button.textContent = 'Copied';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#code'));
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    button.textContent = 'Press ⌘C / Ctrl+C';
  }
  setTimeout(() => { button.textContent = 'Copy code'; }, 1600);
}
