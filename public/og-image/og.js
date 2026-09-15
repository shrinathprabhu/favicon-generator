// OG Image Generator. A layout pass turns the form state into a flat list of
// drawing ops (rects, circles, text, images); the same ops are painted onto a
// canvas for PNG/JPG and serialized into SVG, so every format matches.

const W = 1200;
const H = 630;
const FONT_API = 'https://api.fontsource.org/v1/fonts';
const FONT_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';
const STORAGE_KEY = 'favigen:og-image:v1';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const FALLBACK_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const CURATED_FONTS = [
  { id: 'inter', family: 'Inter', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'geist', family: 'Geist', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'manrope', family: 'Manrope', category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { id: 'dm-sans', family: 'DM Sans', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'plus-jakarta-sans', family: 'Plus Jakarta Sans', category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { id: 'space-grotesk', family: 'Space Grotesk', category: 'sans-serif', weights: [300, 400, 500, 600, 700] },
  { id: 'bricolage-grotesque', family: 'Bricolage Grotesque', category: 'sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { id: 'ibm-plex-sans', family: 'IBM Plex Sans', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700] },
  { id: 'outfit', family: 'Outfit', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'sora', family: 'Sora', category: 'sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { id: 'syne', family: 'Syne', category: 'sans-serif', weights: [400, 500, 600, 700, 800] },
  { id: 'fraunces', family: 'Fraunces', category: 'serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { id: 'instrument-serif', family: 'Instrument Serif', category: 'serif', weights: [400] },
  { id: 'playfair-display', family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700, 800, 900] },
  { id: 'dm-serif-display', family: 'DM Serif Display', category: 'serif', weights: [400] },
  { id: 'newsreader', family: 'Newsreader', category: 'serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { id: 'lora', family: 'Lora', category: 'serif', weights: [400, 500, 600, 700] },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', category: 'monospace', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { id: 'ibm-plex-mono', family: 'IBM Plex Mono', category: 'monospace', weights: [100, 200, 300, 400, 500, 600, 700] },
  { id: 'geist-mono', family: 'Geist Mono', category: 'monospace', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] }
].map((font) => ({ ...font, defSubset: 'latin', styles: ['normal'] }));

const THEMES = [
  { id: 'ember', name: 'Ember', bgType: 'glow', bg: '#141518', bg2: '#e08a3c', text: '#f3efe6', muted: '#a3a8b0', accent: '#e08a3c' },
  { id: 'forest', name: 'Forest', bgType: 'glow', bg: '#0e1512', bg2: '#38b26f', text: '#eef5ef', muted: '#9fb5a7', accent: '#4cc585' },
  { id: 'midnight', name: 'Midnight', bgType: 'aurora', bg: '#0b0f1f', bg2: '#4f46e5', text: '#eef0ff', muted: '#a0a8cc', accent: '#38bdf8' },
  { id: 'paper', name: 'Paper', bgType: 'solid', bg: '#f6f3ec', bg2: '#e7e0d0', text: '#1c1b17', muted: '#66645b', accent: '#c2410c' },
  { id: 'mono', name: 'Mono', bgType: 'solid', bg: '#ffffff', bg2: '#e5e5e5', text: '#0a0a0a', muted: '#6b6b6b', accent: '#0a0a0a' },
  { id: 'sunset', name: 'Sunset', bgType: 'linear', bg: '#ff6a3d', bg2: '#9b1d64', text: '#fff8f2', muted: '#ffd9c7', accent: '#ffe08a' },
  { id: 'ocean', name: 'Ocean', bgType: 'linear', bg: '#0f2a3d', bg2: '#11695f', text: '#effaf8', muted: '#a9cbc6', accent: '#7ee0c9' },
  { id: 'blush', name: 'Blush', bgType: 'glow', bg: '#fff5f6', bg2: '#fb7185', text: '#3b0d1a', muted: '#7d4b58', accent: '#e11d48' }
];

const PAIRINGS = [
  { name: 'Clean', heading: 'inter', headingWeight: 800, tracking: -3, lineHeight: 1.06, body: 'inter', bodyWeight: 400 },
  { name: 'Editorial', heading: 'fraunces', headingWeight: 600, tracking: -2, lineHeight: 1.06, body: 'inter', bodyWeight: 400 },
  { name: 'Elegant', heading: 'instrument-serif', headingWeight: 400, tracking: -1, lineHeight: 1.02, body: 'geist', bodyWeight: 400 },
  { name: 'Modern', heading: 'bricolage-grotesque', headingWeight: 800, tracking: -3, lineHeight: 1.04, body: 'manrope', bodyWeight: 500 },
  { name: 'Geometric', heading: 'space-grotesk', headingWeight: 700, tracking: -3, lineHeight: 1.06, body: 'ibm-plex-sans', bodyWeight: 400 },
  { name: 'Technical', heading: 'jetbrains-mono', headingWeight: 700, tracking: -4, lineHeight: 1.12, body: 'geist', bodyWeight: 400 }
];

const DEFAULTS = {
  layout: 'spotlight',
  theme: 'ember',
  title: 'Beautiful social cards, without the design tool',
  description: 'Pick a layout, a font, and your colors. Export a crisp 1200x630 image in seconds.',
  eyebrow: 'Open source',
  brand: 'Favigen',
  footer: 'by @shrinath_prabhu',
  url: 'favigen.lowkey.tools',
  logoMode: 'monogram',
  logoData: '',
  logoPlate: true,
  logoSize: 64,
  logoRadius: 26,
  headingFont: 'inter',
  headingWeight: 800,
  headingSize: 78,
  tracking: -3,
  lineHeight: 1.06,
  autoFit: true,
  bodyFont: 'inter',
  bodyWeight: 400,
  bodySize: 30,
  bgType: 'glow',
  bg: '#141518',
  bg2: '#e08a3c',
  text: '#f3efe6',
  muted: '#a3a8b0',
  accent: '#e08a3c',
  angle: 135,
  pattern: 'none',
  patternOpacity: 8,
  padding: 80,
  format: 'png',
  pngMode: 'compact',
  quality: 90,
  embedFonts: true
};

const NUMBER_KEYS = new Set(['logoSize', 'logoRadius', 'headingWeight', 'headingSize', 'tracking', 'lineHeight', 'bodyWeight', 'bodySize', 'angle', 'patternOpacity', 'padding', 'quality']);
const COLOR_KEYS = ['bg', 'bg2', 'text', 'muted', 'accent'];
const WEIGHT_NAMES = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };

const workspace = document.querySelector('.og-workspace');
const canvas = document.querySelector('#og-canvas');
const statusEl = document.querySelector('#og-status');
const measureCtx = document.createElement('canvas').getContext('2d');
const supportsLetterSpacing = 'letterSpacing' in CanvasRenderingContext2D.prototype;

const fontsById = new Map(CURATED_FONTS.map((font) => [font.id, font]));
const fontFiles = new Map();
let fontListPromise;
let fontListLoaded = false;
let logoImage = null;
let logoImageSrc = '';
let lastOps = [];
let renderQueued = false;
let renderToken = 0;
let sizeTimer;

const state = loadState();

init();

async function init() {
  buildThemeSwatches();
  buildPairingChips();
  buildColorFields();
  document.querySelectorAll('.font-picker').forEach(setupFontPicker);

  if (![state.headingFont, state.bodyFont].every((id) => fontsById.has(id))) {
    await loadFontList().catch(() => {});
    if (!fontsById.has(state.headingFont)) state.headingFont = DEFAULTS.headingFont;
    if (!fontsById.has(state.bodyFont)) state.bodyFont = DEFAULTS.bodyFont;
  }

  syncForm();
  bindForm();
  bindExport();
  requestRender();
}

/* ---------- state ---------- */

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const merged = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) {
        if (key in saved && typeof saved[key] === typeof DEFAULTS[key]) {
          merged[key] = saved[key];
        }
      }
      return merged;
    }
  } catch {
    // Storage can be unavailable (private mode) or hold stale data.
  }
  return { ...DEFAULTS };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A large logo can exceed the quota; the design still works for this session.
  }
}

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

/* ---------- form binding ---------- */

function bindForm() {
  workspace.addEventListener('input', onFieldChange);
  workspace.addEventListener('change', onFieldChange);

  document.querySelector('#logoFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      setStatus('Logo must be 2 MB or smaller.', 'error');
      event.target.value = '';
      return;
    }

    try {
      state.logoData = await readLogo(file);
      state.logoMode = 'upload';
      syncForm();
      commit();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  document.querySelector('#og-reset').addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    document.querySelector('#logoFile').value = '';
    syncForm();
    commit();
  });
}

function onFieldChange(event) {
  const input = event.target;

  if (input.dataset.colorText) {
    const value = normalizeHex(input.value);
    if (value) {
      state[input.dataset.colorText] = value;
      input.closest('.color-input').querySelector('input[type="color"]').value = value;
      state.theme = '';
      commit({ sync: false });
    }
    return;
  }

  const key = input.name;
  if (!key || !(key in DEFAULTS)) return;
  if (input.type === 'radio' && !input.checked) return;

  let value;
  if (input.type === 'checkbox') {
    value = input.checked;
  } else if (NUMBER_KEYS.has(key)) {
    value = Number(input.value);
    if (!Number.isFinite(value)) return;
  } else {
    value = input.value;
  }

  if (state[key] === value) return;
  state[key] = value;

  if (COLOR_KEYS.includes(key) || key === 'bgType') {
    state.theme = '';
  }

  // Typing in text fields should not re-sync the form (it would move the caret).
  commit({ sync: input.type !== 'text' && input.tagName !== 'TEXTAREA' });
}

function commit({ sync = true } = {}) {
  if (sync) syncForm();
  else updateConditionalUi();
  saveState();
  requestRender();
}

function syncForm() {
  workspace.querySelectorAll('[name]').forEach((input) => {
    const key = input.name;
    if (!(key in state)) return;

    if (input.type === 'radio') {
      input.checked = input.value === String(state[key]);
    } else if (input.type === 'checkbox') {
      input.checked = Boolean(state[key]);
    } else if (input.tagName === 'SELECT') {
      return;
    } else if (input.value !== String(state[key])) {
      input.value = state[key];
    }
  });

  for (const key of COLOR_KEYS) {
    document.querySelector(`input[type="color"][name="${key}"]`).value = state[key];
    document.querySelector(`[data-color-text="${key}"]`).value = state[key];
  }

  document.querySelectorAll('.font-picker').forEach((picker) => {
    const font = fontsById.get(state[picker.dataset.fontKey]);
    picker.querySelector('.font-name').textContent = font?.family ?? 'Choose font';
    picker.querySelector('.font-picker-button small').textContent = font?.category ?? '';
    fillWeightSelect(picker.dataset.weightKey, font);
  });

  document.querySelectorAll('#theme-swatches .swatch').forEach((swatch) => {
    swatch.setAttribute('aria-pressed', String(swatch.dataset.theme === state.theme));
  });

  document.querySelectorAll('#pairing-chips .chip').forEach((chip) => {
    const pairing = PAIRINGS[Number(chip.dataset.index)];
    const active = pairing.heading === state.headingFont && pairing.body === state.bodyFont && pairing.headingWeight === state.headingWeight;
    chip.setAttribute('aria-pressed', String(active));
  });

  updateConditionalUi();
}

function updateConditionalUi() {
  document.querySelectorAll('output[data-for]').forEach((output) => {
    output.textContent = formatOutput(output.dataset.for, state[output.dataset.for]);
  });

  toggleByData('showForFormat', (value) => value === state.format);
  toggleByData('showForBg', (value) => value === state.bgType);
  toggleByData('hideForBg', (value) => value !== state.bgType);
  toggleByData('hideForPattern', (value) => value !== state.pattern);
  toggleByData('showForLogo', (value) => value === state.logoMode);
  toggleByData('hideForLogo', (value) => value !== state.logoMode);

  const downloadButton = document.querySelector('#og-download');
  downloadButton.textContent = `Download ${state.format.toUpperCase()}`;
}

function toggleByData(dataKey, isVisible) {
  const attr = dataKey.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  document.querySelectorAll(`[data-${attr}]`).forEach((el) => {
    el.hidden = !isVisible(el.dataset[dataKey]);
  });
}

function formatOutput(key, value) {
  switch (key) {
    case 'quality':
    case 'patternOpacity':
    case 'logoRadius':
      return `${value}%`;
    case 'angle':
      return `${value}°`;
    case 'tracking':
      return `${value > 0 ? '+' : ''}${value}%`;
    case 'lineHeight':
      return Number(value).toFixed(2);
    default:
      return `${value}px`;
  }
}

function buildThemeSwatches() {
  const container = document.querySelector('#theme-swatches');
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.dataset.theme = theme.id;
    button.title = theme.name;
    button.setAttribute('aria-label', `${theme.name} theme`);
    button.style.background = theme.bgType === 'solid'
      ? `linear-gradient(135deg, ${theme.bg} 0 60%, ${theme.accent} 60%)`
      : `linear-gradient(135deg, ${theme.bg} 0 45%, ${theme.bg2} 100%)`;
    button.addEventListener('click', () => {
      const { id, name, ...colors } = theme;
      Object.assign(state, colors, { theme: id });
      commit();
    });
    container.append(button);
  }
}

function buildPairingChips() {
  const container = document.querySelector('#pairing-chips');
  PAIRINGS.forEach((pairing, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.index = String(index);
    chip.textContent = pairing.name;
    chip.title = `${fontsById.get(pairing.heading).family} + ${fontsById.get(pairing.body).family}`;
    chip.addEventListener('click', () => {
      Object.assign(state, {
        headingFont: pairing.heading,
        headingWeight: pairing.headingWeight,
        tracking: pairing.tracking,
        lineHeight: pairing.lineHeight,
        bodyFont: pairing.body,
        bodyWeight: pairing.bodyWeight
      });
      commit();
    });
    container.append(chip);
  });
}

function buildColorFields() {
  document.querySelectorAll('[data-color]').forEach((field) => {
    const key = field.dataset.color;
    const id = `color-${key}`;
    const label = field.querySelector('.field-label');
    label.id = `${id}-label`;

    const wrap = document.createElement('div');
    wrap.className = 'color-input';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.name = key;
    picker.setAttribute('aria-labelledby', label.id);

    const text = document.createElement('input');
    text.type = 'text';
    text.maxLength = 7;
    text.spellcheck = false;
    text.dataset.colorText = key;
    text.setAttribute('aria-labelledby', label.id);

    wrap.append(picker, text);
    field.append(wrap);
  });
}

function fillWeightSelect(key, font) {
  const select = document.querySelector(`select[name="${key}"]`);
  const weights = font?.weights?.length ? font.weights : [400];
  const nearest = nearestWeight(weights, state[key]);
  state[key] = nearest;
  select.replaceChildren(...weights.map((weight) => new Option(`${weight} · ${WEIGHT_NAMES[weight] ?? ''}`.trim(), String(weight), false, weight === nearest)));
  select.value = String(nearest);
}

function normalizeHex(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!match) return '';
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return `#${hex.toLowerCase()}`;
}

/* ---------- font picker ---------- */

function loadFontList() {
  fontListPromise ??= fetch(FONT_API)
    .then((response) => {
      if (!response.ok) throw new Error(`Font list request failed (${response.status}).`);
      return response.json();
    })
    .then((fonts) => {
      for (const font of fonts) {
        if (!font?.id || !Array.isArray(font.weights) || font.category === 'icons') continue;
        fontsById.set(font.id, {
          id: font.id,
          family: font.family,
          category: font.category,
          weights: font.weights,
          defSubset: font.defSubset || 'latin',
          styles: font.styles?.length ? font.styles : ['normal']
        });
      }
      fontListLoaded = true;
    })
    .catch((error) => {
      fontListPromise = undefined;
      throw error;
    });

  return fontListPromise;
}

function setupFontPicker(picker) {
  const key = picker.dataset.fontKey;
  const weightKey = picker.dataset.weightKey;
  const listId = `${key}-list`;

  picker.innerHTML = `
    <button type="button" class="font-picker-button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${picker.dataset.labelledby} ${key}-current">
      <span class="font-name" id="${key}-current"></span><small></small>
    </button>
    <div class="font-popover" hidden>
      <input type="search" role="combobox" aria-controls="${listId}" aria-expanded="true" aria-autocomplete="list" placeholder="Search fonts" aria-label="Search fonts">
      <div class="chips" data-categories></div>
      <ul class="font-list" id="${listId}" role="listbox"></ul>
    </div>`;

  const button = picker.querySelector('.font-picker-button');
  const popover = picker.querySelector('.font-popover');
  const search = picker.querySelector('input[type="search"]');
  const list = picker.querySelector('.font-list');
  const categoryBar = picker.querySelector('[data-categories]');
  let category = 'all';
  let results = [];
  let activeIndex = -1;

  for (const [value, label] of [['all', 'All'], ['sans-serif', 'Sans'], ['serif', 'Serif'], ['display', 'Display'], ['monospace', 'Mono'], ['handwriting', 'Script']]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(value === category));
    chip.addEventListener('click', () => {
      category = value;
      categoryBar.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      renderList();
      search.focus();
    });
    categoryBar.append(chip);
  }

  const open = () => {
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    search.value = '';
    renderList();
    search.focus();

    if (!fontListLoaded) {
      list.innerHTML = '';
      list.append(emptyItem('Loading 2,000+ fonts…'));
      loadFontList().then(renderList).catch(() => {
        renderList();
        list.prepend(emptyItem('Could not load the full Fontsource list. Showing popular fonts.'));
      });
    }
  };

  const close = ({ focus = true } = {}) => {
    if (popover.hidden) return;
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  };

  const select = (font) => {
    state[key] = font.id;
    state[weightKey] = nearestWeight(font.weights, state[weightKey]);
    close();
    commit();
  };

  function renderList() {
    const query = search.value.trim().toLowerCase();
    const pool = query || category !== 'all' ? [...fontsById.values()] : CURATED_FONTS;
    results = pool
      .filter((font) => (category === 'all' || font.category === category) && (!query || font.family.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (!query) return 0;
        return Number(!a.family.toLowerCase().startsWith(query)) - Number(!b.family.toLowerCase().startsWith(query)) || a.family.localeCompare(b.family);
      })
      .slice(0, 80);

    activeIndex = Math.max(0, results.findIndex((font) => font.id === state[key]));
    list.replaceChildren();

    if (!results.length) {
      list.append(emptyItem(fontListLoaded ? 'No fonts match.' : 'Loading fonts…'));
      return;
    }

    results.forEach((font, index) => {
      const item = document.createElement('li');
      item.className = 'font-option';
      item.id = `${key}-option-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(font.id === state[key]));
      item.innerHTML = '<span></span><small></small>';
      item.firstChild.textContent = font.family;
      item.lastChild.textContent = font.category;
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => select(font));
      list.append(item);
    });

    highlight();
  }

  function highlight() {
    list.querySelectorAll('.font-option').forEach((item, index) => item.classList.toggle('active', index === activeIndex));
    const active = list.children[activeIndex];
    if (active?.classList.contains('font-option')) {
      search.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  button.addEventListener('click', () => (popover.hidden ? open() : close()));
  search.addEventListener('input', renderList);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results[activeIndex]) select(results[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!picker.contains(event.target)) close({ focus: false });
  });
  picker.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !picker.contains(event.relatedTarget)) close({ focus: false });
  });
}

function emptyItem(text) {
  const item = document.createElement('li');
  item.className = 'font-empty';
  item.textContent = text;
  return item;
}

/* ---------- font loading ---------- */

function nearestWeight(weights, target) {
  return weights.reduce((best, weight) => (Math.abs(weight - target) < Math.abs(best - target) ? weight : best), weights[0] ?? 400);
}

function fontSpec(fontId, weight) {
  const font = fontsById.get(fontId) ?? fontsById.get('inter');
  const resolved = nearestWeight(font.weights, weight);
  const style = font.styles.includes('normal') ? 'normal' : font.styles[0];
  const faceFamily = `og_${font.id.replace(/[^a-z0-9]/gi, '_')}`;
  return {
    key: `${font.id}:${resolved}:${style}`,
    font,
    weight: resolved,
    style,
    faceFamily,
    canvasFamily: `"${faceFamily}", ${FALLBACK_STACK}`,
    svgFamily: `'${font.family.replace(/'/g, '')}', ${FALLBACK_STACK.replace(/"/g, "'")}`
  };
}

function ensureFont(spec) {
  let entry = fontFiles.get(spec.key);
  if (entry) return entry.promise;

  const url = `${FONT_CDN}/${spec.font.id}@latest/${spec.font.defSubset}-${spec.weight}-${spec.style}.woff2`;
  entry = {
    buffer: null,
    promise: fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load ${spec.font.family} ${spec.weight}.`);
        return response.arrayBuffer();
      })
      .then(async (buffer) => {
        const face = new FontFace(spec.faceFamily, buffer.slice(0), { weight: String(spec.weight), style: spec.style });
        await face.load();
        document.fonts.add(face);
        entry.buffer = buffer;
      })
      .catch((error) => {
        fontFiles.delete(spec.key);
        throw error;
      })
  };

  fontFiles.set(spec.key, entry);
  return entry.promise;
}

/* ---------- logo ---------- */

async function readLogo(file) {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (!isSvg && !/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    throw new Error('Logo must be an SVG, PNG, WebP, or JPG file.');
  }

  if (isSvg) {
    const text = await file.text();
    if (!/<svg[\s>]/i.test(text)) throw new Error('That file does not look like an SVG.');
    return `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(sizeSvg(text)))}`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the logo file.'));
    reader.readAsDataURL(file);
  });
}

// SVGs without width/height draw at 300x150 or 0x0 in some browsers; give them a size from the viewBox.
function sizeSvg(svgText) {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (doc.querySelector('parsererror') || svg.nodeName.toLowerCase() !== 'svg') return svgText;
    const viewBox = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
      const scale = 512 / Math.max(viewBox[2], viewBox[3]);
      if (!svg.hasAttribute('width') || /%$/.test(svg.getAttribute('width'))) svg.setAttribute('width', String(Math.round(viewBox[2] * scale)));
      if (!svg.hasAttribute('height') || /%$/.test(svg.getAttribute('height'))) svg.setAttribute('height', String(Math.round(viewBox[3] * scale)));
    }
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgText;
  }
}

function loadLogoImage(src) {
  if (!src) return Promise.resolve(null);
  if (src === logoImageSrc && logoImage) return Promise.resolve(logoImage);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      logoImageSrc = src;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------- render pipeline ---------- */

function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

async function render() {
  const token = ++renderToken;
  const s = { ...state };
  const specs = {
    heading: fontSpec(s.headingFont, s.headingWeight),
    body: fontSpec(s.bodyFont, s.bodyWeight),
    bodyStrong: fontSpec(s.bodyFont, Math.max(600, s.bodyWeight))
  };

  const pending = Object.values(specs).filter((spec) => !fontFiles.get(spec.key)?.buffer);
  if (pending.length) setStatus('Loading fonts…');

  const [fontResults, logo] = await Promise.all([
    Promise.allSettled(Object.values(specs).map(ensureFont)),
    s.logoMode === 'upload' ? loadLogoImage(s.logoData) : Promise.resolve(null)
  ]);

  if (token !== renderToken) return;

  const failed = fontResults.find((result) => result.status === 'rejected');
  setStatus(failed ? `${failed.reason.message} Using a system font.` : '', failed ? 'error' : '');

  lastOps = buildLayout(s, { specs, logo });
  paintCanvas(canvas, s, lastOps);
  scheduleSizeEstimate();
}

/* ---------- text measurement ---------- */

function measure(text, spec, size, tracking) {
  measureCtx.font = `${spec.style === 'italic' ? 'italic ' : ''}${spec.weight} ${size}px ${spec.canvasFamily}`;
  if (supportsLetterSpacing) measureCtx.letterSpacing = '0px';
  return measureCtx.measureText(text).width + tracking * size * [...text].length;
}

function wrap(text, width, measureLine) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureLine(candidate) <= width) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);

      if (measureLine(word) <= width) {
        line = word;
        continue;
      }

      // Break a single word that is wider than the line.
      line = '';
      for (const char of word) {
        if (line && measureLine(line + char) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }

    if (line || !words.length) lines.push(line);
  }
  return lines;
}

// Like CSS text-wrap: balance. Keeps the line count but evens out line lengths.
function balancedWrap(text, width, measureLine) {
  const lines = wrap(text, width, measureLine);
  if (lines.length < 2) return lines;

  let lo = width * 0.5;
  let hi = width;
  for (let i = 0; i < 10; i += 1) {
    const mid = (lo + hi) / 2;
    if (wrap(text, mid, measureLine).length === lines.length) hi = mid;
    else lo = mid;
  }
  return wrap(text, hi, measureLine);
}

function clampLines(lines, maxLines, width, measureLine) {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measureLine(`${last}…`) > width) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function textBlock({ text, spec, size, minSize = size, lineHeight, tracking = 0, width, maxLines, maxHeight = Infinity, color, autoFit = false, balance = true, uppercase = false }) {
  const content = uppercase ? String(text).toUpperCase() : String(text).trim();
  if (!content) return null;

  let fontSize = size;
  let lines;
  const measureLine = () => (line) => measure(line, spec, fontSize, tracking);

  while (true) {
    lines = (balance ? balancedWrap : wrap)(content, width, measureLine());
    const fits = lines.length <= maxLines && lines.length * fontSize * lineHeight <= maxHeight;
    if (fits || !autoFit || fontSize <= minSize) break;
    fontSize = Math.max(minSize, fontSize - 2);
  }

  const heightLines = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (fontSize * lineHeight)) || 1));
  lines = clampLines(lines, heightLines, width, measureLine());

  return {
    lines,
    spec,
    size: fontSize,
    lineHeight,
    tracking,
    color,
    height: lines.length * fontSize * lineHeight,
    width: Math.max(...lines.map(measureLine()))
  };
}

function blockOps(block, x, top, anchor = 'start') {
  const { size, lineHeight } = block;
  return block.lines.map((line, index) => ({
    type: 'text',
    text: line,
    x,
    y: top + size * lineHeight * index + size * ((lineHeight - 1) / 2 + 0.8),
    spec: block.spec,
    size,
    color: block.color,
    tracking: block.tracking,
    anchor
  }));
}

/* ---------- layouts ---------- */

function buildLayout(s, env) {
  const layout = LAYOUTS[s.layout] ?? LAYOUTS.spotlight;
  return layout(s, env);
}

const LAYOUTS = {
  spotlight(s, env) {
    const P = s.padding;
    const ops = [];
    let top = P;
    let bottom = H - P;

    const header = brandRow(s, env, { x: P, y: P, maxWidth: W - 2 * P });
    if (header) {
      ops.push(...header.ops);
      top = P + header.height + 40;
    }

    const footer = footerRow(s, env, { left: P, right: W - P, baseline: H - P });
    if (footer) {
      ops.push(...footer.ops);
      bottom = H - P - footer.size - 36;
    }

    const stack = contentStack(s, env, { width: W - 2 * P, maxHeight: bottom - top });
    ops.push(...stack.ops(P, top + Math.max(0, (bottom - top - stack.height) / 2), 'start'));
    return ops;
  },

  centered(s, env) {
    const P = s.padding;
    const ops = [];
    let top = P;
    let bottom = H - P;

    const header = brandRow(s, env, { x: 0, y: P, maxWidth: W - 2 * P, measureOnly: true });
    if (header) {
      ops.push(...brandRow(s, env, { x: (W - header.width) / 2, y: P, maxWidth: W - 2 * P }).ops);
      top = P + header.height + 36;
    }

    const parts = inlineParts(s);
    if (parts.length) {
      const size = footerSize(s);
      ops.push(...inlineOps(parts, env, size, W / 2, H - P, 'middle'));
      bottom = H - P - size - 36;
    }

    const stack = contentStack(s, env, { width: W - 2 * P - 100, maxHeight: bottom - top, balanceDescription: true });
    ops.push(...stack.ops(W / 2, top + Math.max(0, (bottom - top - stack.height) / 2), 'middle'));
    return ops;
  },

  split(s, env) {
    const P = s.padding;
    const ops = [];
    const art = Math.min(300, H - 2 * P - 40);
    const artX = W - P - art;
    const artY = (H - art) / 2;
    const columnWidth = artX - P - 72;

    ops.push({ type: 'circle', cx: artX + art / 2, cy: H / 2, r: art * 0.78, fill: s.accent, opacity: 0.12 });
    ops.push(...logoOps(s, env, artX, artY, art, { forceMark: true }));

    let top = P;
    let bottom = H - P;

    if (s.brand.trim()) {
      const size = brandSize(s);
      ops.push(...blockOps(textBlock({ text: s.brand, spec: env.specs.heading, size, lineHeight: 1.2, width: columnWidth, maxLines: 1, color: s.text, balance: false }), P, P));
      top = P + size * 1.2 + 36;
    }

    const parts = inlineParts(s);
    if (parts.length) {
      const size = footerSize(s);
      ops.push(...inlineOps(parts, env, size, P, H - P, 'start', columnWidth));
      bottom = H - P - size - 36;
    }

    const stack = contentStack(s, env, { width: columnWidth, maxHeight: bottom - top, titleScale: 0.9 });
    ops.push(...stack.ops(P, top + Math.max(0, (bottom - top - stack.height) / 2), 'start'));
    return ops;
  },

  editorial(s, env) {
    const P = s.padding;
    const inset = Math.round(P * 0.34);
    const ops = [
      { type: 'rect', x: inset, y: inset, w: W - 2 * inset, h: H - 2 * inset, stroke: s.text, strokeOpacity: 0.2, strokeWidth: 2 }
    ];

    let top = P;
    const eyebrow = s.eyebrow.trim()
      ? textBlock({ text: s.eyebrow, spec: env.specs.bodyStrong, size: eyebrowSize(s), lineHeight: 1.2, tracking: 0.14, width: W - 2 * P - 64, maxLines: 1, color: s.accent, uppercase: true, balance: false })
      : null;
    ops.push({ type: 'rect', x: P, y: P + (eyebrow ? eyebrow.height / 2 : 0) - 1.5, w: 44, h: 3, fill: s.accent });
    if (eyebrow) {
      ops.push(...blockOps(eyebrow, P + 60, P));
      top = P + eyebrow.height + 40;
    } else {
      top = P + 40;
    }

    const rowSize = footerSize(s);
    const rowBaseline = H - P;
    const dividerY = rowBaseline - rowSize - 26;
    ops.push({ type: 'rect', x: P, y: dividerY, w: W - 2 * P, h: 1.5, fill: s.text, fillOpacity: 0.2 });

    const logoSize = Math.min(s.logoSize, 44);
    let brandX = P;
    const hasMark = hasLogo(s, env);
    if (hasMark) {
      ops.push(...logoOps(s, env, P, rowBaseline - rowSize * 0.36 - logoSize / 2, logoSize));
      brandX += logoSize + 14;
    }
    if (s.brand.trim()) {
      ops.push({ type: 'text', text: s.brand.trim(), x: brandX, y: rowBaseline, spec: env.specs.heading, size: rowSize * 1.08, color: s.text, tracking: 0, anchor: 'start' });
    }
    const parts = inlineParts(s);
    if (parts.length) {
      ops.push(...inlineOps(parts, env, rowSize, W - P, rowBaseline, 'end', (W - 2 * P) * 0.6));
    }

    const bottom = dividerY - 44;
    const stack = contentStack(s, env, { width: W - 2 * P, maxHeight: bottom - top, includeEyebrow: false });
    ops.push(...stack.ops(P, bottom - stack.height, 'start'));
    return ops;
  }
};

function brandSize(s) {
  return Math.round(Math.max(26, Math.min(44, s.logoSize * 0.5)));
}

function footerSize(s) {
  return Math.round(Math.max(18, Math.min(30, s.bodySize * 0.78)));
}

function eyebrowSize(s) {
  return Math.round(Math.max(15, Math.min(26, s.bodySize * 0.62)));
}

function hasLogo(s, env) {
  return s.logoMode === 'monogram' || (s.logoMode === 'upload' && Boolean(env.logo));
}

function brandRow(s, env, { x, y, maxWidth, measureOnly = false }) {
  const withLogo = hasLogo(s, env);
  const brand = s.brand.trim();
  if (!withLogo && !brand) return null;

  const L = s.logoSize;
  const size = brandSize(s);
  const height = withLogo ? L : size * 1.2;
  const ops = [];
  let cursor = x;

  if (withLogo) {
    if (!measureOnly) ops.push(...logoOps(s, env, x, y, L));
    cursor += L + (brand ? 18 : 0);
  }

  if (brand) {
    const block = textBlock({ text: brand, spec: env.specs.heading, size, lineHeight: 1.2, tracking: -0.01, width: maxWidth - (cursor - x), maxLines: 1, color: s.text, balance: false });
    if (!measureOnly) ops.push(...blockOps(block, cursor, y + (height - block.height) / 2));
    cursor += block.width;
  }

  return { ops, height, width: cursor - x };
}

function footerRow(s, env, { left, right, baseline }) {
  const footer = s.footer.trim();
  const url = s.url.trim();
  if (!footer && !url) return null;

  const size = footerSize(s);
  const ops = [];
  const half = (right - left) / 2 - 24;

  if (footer) {
    const block = textBlock({ text: footer, spec: env.specs.body, size, lineHeight: 1, width: url ? half : right - left, maxLines: 1, color: s.muted, balance: false });
    ops.push(textOp(block.lines[0], left, baseline, env.specs.body, size, s.muted, 'start'));
  }

  if (url) {
    const block = textBlock({ text: url, spec: env.specs.bodyStrong, size, lineHeight: 1, width: footer ? half : right - left, maxLines: 1, color: s.accent, balance: false });
    ops.push(footer
      ? textOp(block.lines[0], right, baseline, env.specs.bodyStrong, size, s.accent, 'end')
      : textOp(block.lines[0], left, baseline, env.specs.bodyStrong, size, s.accent, 'start'));
  }

  return { ops, size };
}

function inlineParts(s) {
  const parts = [];
  if (s.footer.trim()) parts.push({ text: s.footer.trim(), role: 'body', color: s.muted });
  if (s.footer.trim() && s.url.trim()) parts.push({ text: '  ·  ', role: 'body', color: s.muted });
  if (s.url.trim()) parts.push({ text: s.url.trim(), role: 'bodyStrong', color: s.accent });
  return parts;
}

function inlineOps(parts, env, size, x, baseline, anchor, maxWidth = W) {
  const widths = parts.map((part) => measure(part.text, env.specs[part.role], size, 0));
  const total = widths.reduce((sum, width) => sum + width, 0);
  const scale = total > maxWidth ? maxWidth / total : 1;
  const fontSize = size * scale;
  let cursor = anchor === 'middle' ? x - (total * scale) / 2 : anchor === 'end' ? x - total * scale : x;

  return parts.map((part, index) => {
    const op = textOp(part.text, cursor, baseline, env.specs[part.role], fontSize, part.color, 'start');
    cursor += widths[index] * scale;
    return op;
  });
}

function textOp(text, x, y, spec, size, color, anchor) {
  return { type: 'text', text, x, y, spec, size, color, tracking: 0, anchor };
}

function contentStack(s, env, { width, maxHeight, includeEyebrow = true, titleScale = 1, balanceDescription = false }) {
  const eyebrow = includeEyebrow && s.eyebrow.trim()
    ? textBlock({ text: s.eyebrow, spec: env.specs.bodyStrong, size: eyebrowSize(s), lineHeight: 1.2, tracking: 0.14, width, maxLines: 1, color: s.accent, uppercase: true, balance: false })
    : null;
  const eyebrowGap = eyebrow ? 22 : 0;
  const titleGap = Math.round(Math.max(20, s.bodySize * 0.75));
  const titleSize = Math.round(s.headingSize * titleScale);

  let title;
  let description;
  for (const descLines of [3, 2, 1, 0]) {
    description = s.description.trim() && descLines
      ? textBlock({ text: s.description, spec: env.specs.body, size: s.bodySize, lineHeight: 1.42, width: Math.min(width, 980), maxLines: descLines, color: s.muted, balance: balanceDescription })
      : null;

    const reserved = (eyebrow ? eyebrow.height + eyebrowGap : 0) + (description ? description.height + titleGap : 0);
    title = textBlock({
      text: s.title || ' ',
      spec: env.specs.heading,
      size: titleSize,
      minSize: 36,
      lineHeight: s.lineHeight,
      tracking: s.tracking / 100,
      width,
      maxLines: 4,
      maxHeight: Math.max(titleSize * s.lineHeight, maxHeight - reserved),
      color: s.text,
      autoFit: s.autoFit
    });

    if (!title || title.height + reserved <= maxHeight || !description) break;
  }

  const blocks = [];
  if (eyebrow) blocks.push([eyebrow, eyebrowGap]);
  if (title) blocks.push([title, description ? titleGap : 0]);
  if (description) blocks.push([description, 0]);

  const height = blocks.reduce((sum, [block, gap]) => sum + block.height + gap, 0);

  return {
    height,
    ops(x, top, anchor) {
      const ops = [];
      let y = top;
      for (const [block, gap] of blocks) {
        ops.push(...blockOps(block, x, y, anchor));
        y += block.height + gap;
      }
      return ops;
    }
  };
}

function logoOps(s, env, x, y, size, { forceMark = false } = {}) {
  const radius = (size * s.logoRadius) / 100;
  const upload = s.logoMode === 'upload' && env.logo;

  if (upload) {
    const ops = [];
    let inset = 0;
    if (s.logoPlate) {
      ops.push({ type: 'rect', x, y, w: size, h: size, r: radius, fill: s.text, fillOpacity: 0.08, stroke: s.text, strokeOpacity: 0.14, strokeWidth: Math.max(1, size / 64) });
      inset = size * 0.18;
    }
    const box = size - inset * 2;
    const naturalW = env.logo.naturalWidth || box;
    const naturalH = env.logo.naturalHeight || box;
    const scale = Math.min(box / naturalW, box / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    ops.push({ type: 'image', x: x + inset + (box - w) / 2, y: y + inset + (box - h) / 2, w, h, img: env.logo, href: s.logoData, r: s.logoPlate ? 0 : radius });
    return ops;
  }

  if (s.logoMode === 'none' && !forceMark) return [];

  const letter = [...(s.brand.trim() || s.title.trim() || 'A')][0].toUpperCase();
  const fontSize = size * 0.54;
  return [
    { type: 'rect', x, y, w: size, h: size, r: radius, fill: s.accent },
    { type: 'text', text: letter, x: x + size / 2, y: y + size / 2 + fontSize * 0.36, spec: env.specs.heading, size: fontSize, color: s.bg, tracking: 0, anchor: 'middle' }
  ];
}

/* ---------- background geometry (shared by both renderers) ---------- */

function glowSpots(s) {
  const centered = s.layout === 'centered';
  if (s.bgType === 'glow') {
    return [{ cx: centered ? W / 2 : W * 0.14, cy: 0, r: centered ? 760 : 900, color: s.bg2, alpha: 0.42 }];
  }
  if (s.bgType === 'aurora') {
    return [
      { cx: W * 0.08, cy: -40, r: 780, color: s.bg2, alpha: 0.55 },
      { cx: W * 0.98, cy: H + 60, r: 720, color: s.accent, alpha: 0.32 }
    ];
  }
  return [];
}

function linearPoints(angle) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
  return { x1: W / 2 - dx * half, y1: H / 2 - dy * half, x2: W / 2 + dx * half, y2: H / 2 + dy * half };
}

function patternFade(s) {
  return s.layout === 'centered'
    ? { cx: W / 2, cy: H * 0.2, r: 820 }
    : { cx: W * 0.92, cy: H * 0.1, r: 980 };
}

const GLOW_STOPS = [[0, 1], [0.45, 0.45], [1, 0]];

/* ---------- canvas renderer ---------- */

function paintCanvas(target, s, ops) {
  const ctx = target.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (s.bgType === 'linear') {
    const p = linearPoints(s.angle);
    const gradient = ctx.createLinearGradient(p.x1, p.y1, p.x2, p.y2);
    gradient.addColorStop(0, s.bg);
    gradient.addColorStop(1, s.bg2);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = s.bg;
  }
  ctx.fillRect(0, 0, W, H);

  for (const spot of glowSpots(s)) {
    const gradient = ctx.createRadialGradient(spot.cx, spot.cy, 0, spot.cx, spot.cy, spot.r);
    for (const [offset, strength] of GLOW_STOPS) {
      gradient.addColorStop(offset, rgba(spot.color, spot.alpha * strength));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  if (s.pattern !== 'none') {
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const lctx = layer.getContext('2d');
    lctx.fillStyle = s.text;
    if (s.pattern === 'grid') {
      for (let x = 0; x < W; x += 48) lctx.fillRect(x, 0, 1, H);
      for (let y = 0; y < H; y += 48) lctx.fillRect(0, y, W, 1);
    } else {
      for (let x = 16; x < W; x += 32) {
        for (let y = 16; y < H; y += 32) {
          lctx.beginPath();
          lctx.arc(x, y, 1.6, 0, Math.PI * 2);
          lctx.fill();
        }
      }
    }
    const fade = patternFade(s);
    const mask = lctx.createRadialGradient(fade.cx, fade.cy, 0, fade.cx, fade.cy, fade.r);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.globalCompositeOperation = 'destination-in';
    lctx.fillStyle = mask;
    lctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = s.patternOpacity / 100;
    ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = 1;
  }

  for (const op of ops) {
    if (op.type === 'rect') {
      ctx.beginPath();
      if (op.r) roundRectPath(ctx, op.x, op.y, op.w, op.h, op.r);
      else ctx.rect(op.x, op.y, op.w, op.h);
      if (op.fill) {
        ctx.globalAlpha = op.fillOpacity ?? 1;
        ctx.fillStyle = op.fill;
        ctx.fill();
      }
      if (op.stroke) {
        ctx.globalAlpha = op.strokeOpacity ?? 1;
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.strokeWidth ?? 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (op.type === 'circle') {
      ctx.globalAlpha = op.opacity ?? 1;
      ctx.fillStyle = op.fill;
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (op.type === 'image') {
      ctx.save();
      if (op.r) {
        ctx.beginPath();
        roundRectPath(ctx, op.x, op.y, op.w, op.h, Math.min(op.r, op.w / 2, op.h / 2));
        ctx.clip();
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(op.img, op.x, op.y, op.w, op.h);
      ctx.restore();
    } else if (op.type === 'text') {
      drawCanvasText(ctx, op);
    }
  }

  ctx.restore();
}

function drawCanvasText(ctx, op) {
  ctx.font = `${op.spec.style === 'italic' ? 'italic ' : ''}${op.spec.weight} ${op.size}px ${op.spec.canvasFamily}`;
  ctx.fillStyle = op.color;
  ctx.textBaseline = 'alphabetic';
  const spacing = op.tracking * op.size;

  if (!spacing || supportsLetterSpacing) {
    if (supportsLetterSpacing) ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = op.anchor === 'middle' ? 'center' : op.anchor === 'end' ? 'right' : 'left';
    ctx.fillText(op.text, op.x, op.y);
    if (supportsLetterSpacing) ctx.letterSpacing = '0px';
    return;
  }

  // Older browsers without ctx.letterSpacing: place characters one by one.
  const chars = [...op.text];
  const total = ctx.measureText(op.text).width + spacing * chars.length;
  let x = op.anchor === 'middle' ? op.x - total / 2 : op.anchor === 'end' ? op.x - total : op.x;
  ctx.textAlign = 'left';
  for (const char of chars) {
    ctx.fillText(char, x, op.y);
    x += ctx.measureText(char).width + spacing;
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function rgba(hex, alpha) {
  const value = normalizeHex(hex) || '#000000';
  const n = Number.parseInt(value.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

/* ---------- SVG renderer ---------- */

function buildSvg(s, ops, { embedFonts }) {
  const defs = [];
  const body = [];
  const n = (value) => Math.round(value * 100) / 100;

  if (embedFonts) {
    const faces = new Map();
    for (const op of ops) {
      if (op.type !== 'text') continue;
      const buffer = fontFiles.get(op.spec.key)?.buffer;
      if (buffer && !faces.has(op.spec.key)) {
        faces.set(op.spec.key, `@font-face{font-family:'${op.spec.font.family.replace(/'/g, '')}';font-weight:${op.spec.weight};font-style:${op.spec.style};src:url(data:font/woff2;base64,${bytesToBase64(new Uint8Array(buffer))}) format('woff2')}`);
      }
    }
    if (faces.size) defs.push(`<style>${[...faces.values()].join('')}</style>`);
  }

  if (s.bgType === 'linear') {
    const p = linearPoints(s.angle);
    defs.push(`<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}"><stop offset="0" stop-color="${s.bg}"/><stop offset="1" stop-color="${s.bg2}"/></linearGradient>`);
    body.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
  } else {
    body.push(`<rect width="${W}" height="${H}" fill="${s.bg}"/>`);
  }

  glowSpots(s).forEach((spot, index) => {
    const stops = GLOW_STOPS.map(([offset, strength]) => `<stop offset="${offset}" stop-color="${spot.color}" stop-opacity="${n(spot.alpha * strength)}"/>`).join('');
    defs.push(`<radialGradient id="glow${index}" gradientUnits="userSpaceOnUse" cx="${n(spot.cx)}" cy="${n(spot.cy)}" r="${spot.r}">${stops}</radialGradient>`);
    body.push(`<rect width="${W}" height="${H}" fill="url(#glow${index})"/>`);
  });

  if (s.pattern !== 'none') {
    const fade = patternFade(s);
    defs.push(s.pattern === 'grid'
      ? `<pattern id="pat" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="1" height="48" fill="${s.text}"/><rect width="48" height="1" fill="${s.text}"/></pattern>`
      : `<pattern id="pat" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.6" fill="${s.text}"/></pattern>`);
    defs.push(`<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${n(fade.cx)}" cy="${n(fade.cy)}" r="${fade.r}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
    defs.push(`<mask id="patmask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`);
    body.push(`<rect width="${W}" height="${H}" fill="url(#pat)" opacity="${s.patternOpacity / 100}" mask="url(#patmask)"/>`);
  }

  let clipIndex = 0;
  for (const op of ops) {
    if (op.type === 'rect') {
      const attrs = [`x="${n(op.x)}"`, `y="${n(op.y)}"`, `width="${n(op.w)}"`, `height="${n(op.h)}"`];
      if (op.r) attrs.push(`rx="${n(Math.min(op.r, op.w / 2, op.h / 2))}"`);
      attrs.push(`fill="${op.fill ?? 'none'}"`);
      if (op.fill && op.fillOpacity != null) attrs.push(`fill-opacity="${op.fillOpacity}"`);
      if (op.stroke) attrs.push(`stroke="${op.stroke}"`, `stroke-width="${op.strokeWidth ?? 1}"`);
      if (op.stroke && op.strokeOpacity != null) attrs.push(`stroke-opacity="${op.strokeOpacity}"`);
      body.push(`<rect ${attrs.join(' ')}/>`);
    } else if (op.type === 'circle') {
      body.push(`<circle cx="${n(op.cx)}" cy="${n(op.cy)}" r="${n(op.r)}" fill="${op.fill}" opacity="${op.opacity ?? 1}"/>`);
    } else if (op.type === 'image') {
      let clip = '';
      if (op.r) {
        const id = `clip${clipIndex++}`;
        defs.push(`<clipPath id="${id}"><rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" rx="${n(Math.min(op.r, op.w / 2, op.h / 2))}"/></clipPath>`);
        clip = ` clip-path="url(#${id})"`;
      }
      body.push(`<image href="${escapeXml(op.href)}" x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" preserveAspectRatio="xMidYMid meet"${clip}/>`);
    } else if (op.type === 'text') {
      const attrs = [
        `x="${n(op.x)}"`,
        `y="${n(op.y)}"`,
        `font-family="${escapeXml(op.spec.svgFamily)}"`,
        `font-size="${n(op.size)}"`,
        `font-weight="${op.spec.weight}"`,
        `fill="${op.color}"`
      ];
      if (op.spec.style !== 'normal') attrs.push(`font-style="${op.spec.style}"`);
      if (op.tracking) attrs.push(`letter-spacing="${n(op.tracking * op.size)}"`);
      if (op.anchor !== 'start') attrs.push(`text-anchor="${op.anchor}"`);
      body.push(`<text ${attrs.join(' ')} xml:space="preserve">${escapeXml(op.text)}</text>`);
    }
  }

  const title = escapeXml(s.title.trim() || 'Open Graph image');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><title>${title}</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body.join('')}</svg>\n`;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/* ---------- PNG encoding ---------- */
// Browsers encode canvas PNGs quickly but loosely (a glow background comes out
// around 600 KB). Re-encoding with per-row filters, or reducing to a dithered
// 256-color palette, gives the same image at a fraction of the size.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

async function encodePng(imageData, compact) {
  if (typeof CompressionStream === 'undefined') return null;

  const { width, height, data } = imageData;
  let header;
  let raw;
  let palette = null;

  const indexed = compact ? quantize(data, width, height) : null;
  if (indexed) {
    header = [8, 3];
    palette = indexed.palette;
    raw = new Uint8Array((width + 1) * height);
    for (let y = 0; y < height; y += 1) {
      raw.set(indexed.pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
    }
  } else {
    header = [8, 2];
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4) {
      rgb[j++] = data[i];
      rgb[j++] = data[i + 1];
      rgb[j++] = data[i + 2];
    }
    raw = filterRows(rgb, width, height, 3);
  }

  const compressed = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([header[0], header[1], 0, 0, 0], 8);

  const chunks = [pngChunk('IHDR', ihdr)];
  if (palette) chunks.push(pngChunk('PLTE', palette));
  chunks.push(pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array(0)));

  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks], { type: 'image/png' });
}

function pngChunk(type, body) {
  const chunk = new Uint8Array(body.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i += 1) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(body, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < body.length + 8; i += 1) crc = CRC_TABLE[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
  view.setUint32(body.length + 8, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}

// Picks the PNG filter per row that minimizes the sum of absolute differences.
function filterRows(pixels, width, height, bpp) {
  const rowLength = width * bpp;
  const out = new Uint8Array((rowLength + 1) * height);
  const candidates = Array.from({ length: 5 }, () => new Uint8Array(rowLength));
  let previous = new Uint8Array(rowLength);

  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * rowLength, (y + 1) * rowLength);
    const scores = [0, 0, 0, 0, 0];

    for (let i = 0; i < rowLength; i += 1) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = previous[i];
      const upLeft = i >= bpp ? previous[i - bpp] : 0;
      const p = left + up - upLeft;
      const pa = Math.abs(p - left);
      const pb = Math.abs(p - up);
      const pc = Math.abs(p - upLeft);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      const values = [row[i], row[i] - left, row[i] - up, row[i] - ((left + up) >> 1), row[i] - paeth];

      for (let f = 0; f < 5; f += 1) {
        const v = values[f] & 255;
        candidates[f][i] = v;
        scores[f] += v < 128 ? v : 256 - v;
      }
    }

    const best = scores.indexOf(Math.min(...scores));
    out[y * (rowLength + 1)] = best;
    out.set(candidates[best], y * (rowLength + 1) + 1);
    previous = row;
  }

  return out;
}

// Median-cut quantization to 256 colors with 4x4 ordered dithering, which hides
// gradient banding while still compressing well (unlike error diffusion).
function quantize(data, width, height) {
  const BITS = 6;
  const SHIFT = 8 - BITS;
  const MASK = (1 << BITS) - 1;
  const bucketOf = (r, g, b) => ((r >> SHIFT) << (2 * BITS)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);

  const exact = new Map();
  for (let i = 0; i < data.length && exact.size <= 256; i += 4) {
    const color = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    if (!exact.has(color)) exact.set(color, exact.size);
  }

  const pixels = new Uint8Array(width * height);

  if (exact.size <= 256) {
    const palette = new Uint8Array(exact.size * 3);
    for (const [color, index] of exact) palette.set([color >> 16, (color >> 8) & 255, color & 255], index * 3);
    for (let p = 0, i = 0; p < pixels.length; p += 1, i += 4) {
      pixels[p] = exact.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    return { palette, pixels };
  }

  const buckets = 1 << (3 * BITS);
  const counts = new Uint32Array(buckets);
  const sums = new Float64Array(buckets * 3);
  const squares = new Float64Array(buckets);
  for (let i = 0; i < data.length; i += 4) {
    const k = bucketOf(data[i], data[i + 1], data[i + 2]);
    counts[k] += 1;
    sums[k * 3] += data[i];
    sums[k * 3 + 1] += data[i + 1];
    sums[k * 3 + 2] += data[i + 2];
    squares[k] += data[i] * data[i] + data[i + 1] * data[i + 1] + data[i + 2] * data[i + 2];
  }

  const used = [];
  for (let k = 0; k < buckets; k += 1) if (counts[k]) used.push(k);

  // A box's error is its sum of squared distances to its mean color. Always
  // split the box with the most error, along its highest-variance channel, at
  // the point that minimizes the error of the two halves. Spending colors where
  // error is highest keeps anti-aliased text edges accurate.
  const makeBox = (keys) => {
    let n = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let sq = 0;
    const channelSquares = [0, 0, 0];
    for (const k of keys) {
      n += counts[k];
      r += sums[k * 3];
      g += sums[k * 3 + 1];
      b += sums[k * 3 + 2];
      sq += squares[k];
      for (let c = 0; c < 3; c += 1) channelSquares[c] += (sums[k * 3 + c] * sums[k * 3 + c]) / counts[k];
    }
    const variances = [channelSquares[0] - (r * r) / n, channelSquares[1] - (g * g) / n, channelSquares[2] - (b * b) / n];
    const channel = [2 * BITS, BITS, 0][variances.indexOf(Math.max(...variances))];
    return { keys, n, r, g, b, sq, channel, error: keys.length > 1 ? sq - (r * r + g * g + b * b) / n : 0 };
  };

  const boxes = [makeBox(used)];
  while (boxes.length < 256) {
    let target = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i].error > 0 && (target < 0 || boxes[i].error > boxes[target].error)) target = i;
    }
    if (target < 0) break;

    const [box] = boxes.splice(target, 1);
    const shift = box.channel;
    box.keys.sort((a, b) => ((a >> shift) & MASK) - ((b >> shift) & MASK));

    let n = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let sq = 0;
    let split = 0;
    let bestError = Infinity;
    for (let i = 0; i < box.keys.length - 1; i += 1) {
      const k = box.keys[i];
      n += counts[k];
      r += sums[k * 3];
      g += sums[k * 3 + 1];
      b += sums[k * 3 + 2];
      sq += squares[k];
      const n2 = box.n - n;
      const r2 = box.r - r;
      const g2 = box.g - g;
      const b2 = box.b - b;
      const error = sq - (r * r + g * g + b * b) / n + (box.sq - sq) - (r2 * r2 + g2 * g2 + b2 * b2) / n2;
      if (error < bestError) {
        bestError = error;
        split = i;
      }
    }
    boxes.push(makeBox(box.keys.slice(0, split + 1)), makeBox(box.keys.slice(split + 1)));
  }

  const palette = new Uint8Array(boxes.length * 3);
  boxes.forEach((box, index) => {
    palette.set([Math.round(box.r / box.n), Math.round(box.g / box.n), Math.round(box.b / box.n)], index * 3);
  });

  const lookup = new Int16Array(buckets).fill(-1);
  const nearest = (r, g, b) => {
    const k = bucketOf(r, g, b);
    let best = lookup[k];
    if (best >= 0) return best;
    let bestDistance = Infinity;
    for (let j = 0; j < palette.length; j += 3) {
      const distance = (palette[j] - r) ** 2 + (palette[j + 1] - g) ** 2 + (palette[j + 2] - b) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = j / 3;
      }
    }
    lookup[k] = best;
    return best;
  };

  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const offset = (bayer[((y & 3) << 2) | (x & 3)] / 16 - 0.5) * 6;
      pixels[y * width + x] = nearest(clamp(data[i] + offset), clamp(data[i + 1] + offset), clamp(data[i + 2] + offset));
    }
  }

  return { palette, pixels };
}

/* ---------- export ---------- */

async function exportBlob(format) {
  if (format === 'svg') {
    return new Blob([buildSvg(state, lastOps, { embedFonts: state.embedFonts })], { type: 'image/svg+xml' });
  }

  if (format === 'png') {
    const imageData = canvas.getContext('2d').getImageData(0, 0, W, H);
    const blob = await encodePng(imageData, state.pngMode === 'compact').catch(() => null);
    if (blob) return blob;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export the image.'))),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? state.quality / 100 : undefined
    );
  });
}

function scheduleSizeEstimate() {
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(async () => {
    for (const format of ['png', 'jpg', 'svg']) {
      const label = document.querySelector(`[data-size="${format}"]`);
      try {
        const blob = await exportBlob(format);
        label.textContent = formatBytes(blob.size);
      } catch {
        label.textContent = '—';
      }
    }
  }, 350);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function bindExport() {
  document.querySelector('#og-download').addEventListener('click', async () => {
    try {
      const blob = await exportBlob(state.format);
      triggerDownload(blob, `${slugify(state.title) || 'og-image'}.${state.format}`);
      setStatus(`Downloaded ${state.format.toUpperCase()} · ${formatBytes(blob.size)}`);
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  const copyButton = document.querySelector('#og-copy');
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    copyButton.hidden = true;
    return;
  }

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob('png') })]);
      setStatus('PNG copied to clipboard.');
    } catch {
      setStatus('Your browser blocked clipboard access.', 'error');
    }
  });
}

function slugify(value) {
  return String(value).toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
