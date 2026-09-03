const form = document.querySelector('#generator-form');
const statusEl = document.querySelector('#status');
const submitButton = form.querySelector('button[type="submit"]');

const PNG_SIZES = [16, 32, 48, 64, 128, 256];
const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const PLATFORM_ICONS = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'mstile-150x150.png', size: 150 }
];

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const appNameInput = form.querySelector('#appName');
  const fileInput = form.querySelector('#imageFile') || form.querySelector('#svg');
  const appName = appNameInput.value.trim();
  const file = fileInput.files?.[0];

  if (!appName) {
    statusEl.textContent = 'App name is required.';
    return;
  }

  if (!file) {
    statusEl.textContent = 'Please choose an image file.';
    return;
  }

  submitButton.disabled = true;
  statusEl.textContent = 'Loading image...';

  try {
    const appSlug = slugifyAppName(appName);
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    let img;
    let originalData;
    let originalFilename;
    let faviconSvgData;

    if (isSvg) {
      statusEl.textContent = 'Reading SVG...';
      const svgText = await file.text();
      validateSvg(svgText, file.name);

      img = await loadSvgImage(svgText);
      originalData = svgText;
      originalFilename = 'original.svg';
      faviconSvgData = svgText;
    } else {
      statusEl.textContent = 'Processing raster image...';
      img = await loadImageFromFile(file);

      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const ext = getFileExtension(file.name) || 'png';
      originalData = rawBytes;
      originalFilename = `original.${ext}`;

      const dataUrl = await readFileAsDataUrl(file);
      faviconSvgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="${dataUrl}" width="512" height="512" preserveAspectRatio="xMidYMid meet"/>
</svg>\n`;
    }

    const pngEntries = new Map();
    for (const size of PNG_SIZES) {
      statusEl.textContent = `Rendering favicon ${size}x${size}...`;
      const blob = await renderPngBlob(img, size);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      pngEntries.set(size, bytes);
    }

    const platformEntries = new Map();
    for (const icon of PLATFORM_ICONS) {
      statusEl.textContent = `Rendering ${icon.name}...`;
      const blob = await renderPngBlob(img, icon.size);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      pngEntries.set(icon.name, bytes);
      platformEntries.set(icon.name, bytes);
    }

    statusEl.textContent = 'Generating favicon.ico...';
    const icoImages = ICO_SIZES.map((size) => ({
      size,
      bytes: pngEntries.get(size)
    }));
    const icoBytes = createIco(icoImages);

    statusEl.textContent = 'Packing ZIP archive...';
    const folder = `${appSlug}-favicon`;
    const zipFiles = [
      { name: `${folder}/favicon.ico`, data: icoBytes },
      { name: `${folder}/favicon.svg`, data: faviconSvgData },
      { name: `${folder}/${originalFilename}`, data: originalData },
      { name: `${folder}/site.webmanifest`, data: createManifest(appName) },
      { name: `${folder}/browserconfig.xml`, data: createBrowserConfig() },
      { name: `${folder}/html-tags.txt`, data: createHtmlTags(appSlug) }
    ];

    for (const size of PNG_SIZES) {
      zipFiles.push({
        name: `${folder}/favicon-${size}x${size}.png`,
        data: pngEntries.get(size)
      });
    }

    for (const icon of PLATFORM_ICONS) {
      zipFiles.push({
        name: `${folder}/${icon.name}`,
        data: platformEntries.get(icon.name)
      });
    }

    const zipBlob = createZip(zipFiles);
    const zipName = `${appSlug}-favicon.zip`;

    triggerDownload(zipBlob, zipName);
    statusEl.textContent = `Downloaded ${zipName}`;
  } catch (error) {
    statusEl.textContent = error.message || 'Generation failed.';
  } finally {
    submitButton.disabled = false;
  }
});

function slugifyAppName(name) {
  const slug = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new Error('App name must contain at least one letter or number.');
  }

  return slug;
}

function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
}

function validateSvg(svgText, inputName = 'input') {
  const trimmed = String(svgText ?? '').trimStart().replace(/^\uFEFF/, '');

  if (!trimmed) {
    throw new Error(`${inputName} is empty.`);
  }

  if (!/<svg(?:\s|>)/i.test(trimmed)) {
    throw new Error(`${inputName} does not look like an SVG document.`);
  }
}

function normalizeSvgForRendering(svgText) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror')) {
      return svgText;
    }

    const svgEl = doc.documentElement;
    if (!svgEl.hasAttribute('width') && !svgEl.hasAttribute('height') && svgEl.hasAttribute('viewBox')) {
      svgEl.setAttribute('width', '512');
      svgEl.setAttribute('height', '512');
      return new XMLSerializer().serializeToString(doc);
    }
  } catch {
    // Fall back to unmodified svgText
  }

  return svgText;
}

async function loadSvgImage(svgText) {
  const normalized = normalizeSvgForRendering(svgText);
  const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return loadImageFromUrl(url);
}

async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return loadImageFromUrl(url);
}

async function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image into browser renderer.'));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image as data URL.'));
    reader.readAsDataURL(file);
  });
}

async function renderPngBlob(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const natW = img.naturalWidth || img.width || size;
  const natH = img.naturalHeight || img.height || size;
  const aspect = natW / natH;

  let drawW = size;
  let drawH = size;
  let dx = 0;
  let dy = 0;

  if (aspect > 1) {
    drawH = size / aspect;
    dy = (size - drawH) / 2;
  } else if (aspect < 1) {
    drawW = size * aspect;
    dx = (size - drawW) / 2;
  }

  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Failed to render PNG for size ${size}x${size}.`));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

function createIco(images) {
  if (!images.length) {
    throw new Error('At least one PNG image is required to create favicon.ico.');
  }

  const headerSize = 6;
  const directoryEntrySize = 16;
  const directorySize = headerSize + images.length * directoryEntrySize;
  const totalSize = directorySize + images.reduce((sum, image) => sum + image.bytes.length, 0);

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);

  let imageOffset = directorySize;

  images.forEach((image, index) => {
    if (image.size < 1 || image.size > 256) {
      throw new Error(`ICO image size must be between 1 and 256. Received ${image.size}.`);
    }

    const entryOffset = headerSize + index * directoryEntrySize;
    const dimension = image.size === 256 ? 0 : image.size;

    view.setUint8(entryOffset, dimension);
    view.setUint8(entryOffset + 1, dimension);
    view.setUint8(entryOffset + 2, 0);
    view.setUint8(entryOffset + 3, 0);
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, image.bytes.length, true);
    view.setUint32(entryOffset + 12, imageOffset, true);

    uint8.set(image.bytes, imageOffset);
    imageOffset += image.bytes.length;
  });

  return uint8;
}

function createManifest(appName) {
  return `${JSON.stringify({
    name: appName,
    short_name: appName,
    icons: [
      {
        src: './android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: './android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone'
  }, null, 2)}\n`;
}

function createBrowserConfig() {
  return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="./mstile-150x150.png"/>
      <TileColor>#ffffff</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`;
}

function createHtmlTags(appSlug) {
  const assetPath = `/${appSlug}-favicon`;

  return `<link rel="icon" href="${assetPath}/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="${assetPath}/favicon.svg">
<link rel="apple-touch-icon" href="${assetPath}/apple-touch-icon.png">
<link rel="manifest" href="${assetPath}/site.webmanifest">
<meta name="msapplication-config" content="${assetPath}/browserconfig.xml">
<meta name="theme-color" content="#ffffff">
`;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(uint8) {
  let crc = 0xffffffff;
  for (let i = 0; i < uint8.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ uint8[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files) {
  const textEncoder = new TextEncoder();
  const fileEntries = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = file.data instanceof Uint8Array ? file.data : textEncoder.encode(file.data);
    const fileCrc = crc32(dataBytes);

    const localHeader = new Uint8Array(30);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, fileCrc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);

    fileEntries.push({
      localHeader,
      nameBytes,
      dataBytes,
      crc: fileCrc,
      offset
    });

    offset += 30 + nameBytes.length + dataBytes.length;
  }

  const centralEntries = [];
  let centralDirSize = 0;

  for (const entry of fileEntries) {
    const cd = new Uint8Array(46);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, entry.crc, true);
    cv.setUint32(20, entry.dataBytes.length, true);
    cv.setUint32(24, entry.dataBytes.length, true);
    cv.setUint16(28, entry.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, entry.offset, true);

    centralEntries.push(cd, entry.nameBytes);
    centralDirSize += 46 + entry.nameBytes.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, fileEntries.length, true);
  ev.setUint16(10, fileEntries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const parts = [];
  for (const entry of fileEntries) {
    parts.push(entry.localHeader, entry.nameBytes, entry.dataBytes);
  }
  parts.push(...centralEntries, eocd);

  return new Blob(parts, { type: 'application/zip' });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
