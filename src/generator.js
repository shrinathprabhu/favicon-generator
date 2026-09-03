import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const PNG_SIZES = [16, 32, 48, 64, 128, 256];
export const ICO_SIZES = [16, 32, 48, 64, 128, 256];
export const PLATFORM_ICONS = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'mstile-150x150.png', size: 150 }
];

export const GENERATED_FILES = [
  'favicon.ico',
  'favicon.svg',
  'original.svg',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'mstile-150x150.png',
  'site.webmanifest',
  'browserconfig.xml',
  'html-tags.txt',
  ...PNG_SIZES.map((size) => `favicon-${size}x${size}.png`)
];

export const SUPPORTED_EXTENSIONS = new Set([
  '.svg',
  '.png',
  '.webp',
  '.jpg',
  '.jpeg',
  '.avif',
  '.gif',
  '.bmp',
  '.ico',
  '.tiff'
]);

export async function generateFaviconAssetsFromFile({ inputPath, appName, outRoot = process.cwd() }) {
  const resolvedInput = path.resolve(inputPath);
  const ext = path.extname(resolvedInput).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported image format: "${ext}". Supported formats: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
  }

  const inputBuffer = await fs.readFile(resolvedInput);
  return generateFaviconAssets({
    inputBuffer,
    sourceExt: ext,
    appName,
    outRoot,
    sourceName: resolvedInput
  });
}

export async function generateFaviconAssets({
  inputBuffer,
  svgText,
  sourceExt,
  appName,
  outRoot = process.cwd(),
  sourceName = 'uploaded file'
}) {
  const appSlug = slugifyAppName(appName);
  const outDir = path.join(path.resolve(outRoot), `${appSlug}-favicon`);

  let rawBuffer;
  let originalFilename;
  let faviconSvgText;

  if (svgText != null) {
    validateSvg(svgText, sourceName);
    rawBuffer = Buffer.from(svgText);
    originalFilename = 'original.svg';
    faviconSvgText = svgText;
  } else if (inputBuffer != null) {
    rawBuffer = Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer);
    const ext = (sourceExt || path.extname(sourceName) || '').toLowerCase();
    const preview = rawBuffer.subarray(0, 100).toString('utf8').trimStart();

    if (ext === '.svg' || /<svg(?:\s|>)/i.test(preview)) {
      const text = rawBuffer.toString('utf8');
      validateSvg(text, sourceName);
      originalFilename = 'original.svg';
      faviconSvgText = text;
    } else {
      const cleanExt = ext.replace(/^\./, '') || 'png';
      originalFilename = `original.${cleanExt}`;
      const mime = getMimeType(cleanExt);
      const base64 = rawBuffer.toString('base64');
      faviconSvgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:${mime};base64,${base64}" width="512" height="512" preserveAspectRatio="xMidYMid meet"/>
</svg>\n`;
    }
  } else {
    throw new Error('Either inputBuffer or svgText must be provided.');
  }

  await fs.mkdir(outDir, { recursive: true });

  const pngBuffers = new Map();
  for (const size of PNG_SIZES) {
    const buffer = await renderPng(rawBuffer, size);
    pngBuffers.set(size, buffer);
    await fs.writeFile(path.join(outDir, `favicon-${size}x${size}.png`), buffer);
  }

  for (const icon of PLATFORM_ICONS) {
    const buffer = await renderPng(rawBuffer, icon.size);
    await fs.writeFile(path.join(outDir, icon.name), buffer);
  }

  const icoBuffers = [];
  for (const size of ICO_SIZES) {
    icoBuffers.push({ size, buffer: pngBuffers.get(size) ?? await renderPng(rawBuffer, size) });
  }

  await fs.writeFile(path.join(outDir, 'favicon.ico'), createIco(icoBuffers));
  await fs.writeFile(path.join(outDir, 'favicon.svg'), faviconSvgText);
  await fs.writeFile(path.join(outDir, originalFilename), rawBuffer);
  await fs.writeFile(path.join(outDir, 'site.webmanifest'), createManifest(appName));
  await fs.writeFile(path.join(outDir, 'browserconfig.xml'), createBrowserConfig());
  await fs.writeFile(path.join(outDir, 'html-tags.txt'), createHtmlTags(appSlug));

  const generatedFiles = [
    'favicon.ico',
    'favicon.svg',
    originalFilename,
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'mstile-150x150.png',
    'site.webmanifest',
    'browserconfig.xml',
    'html-tags.txt',
    ...PNG_SIZES.map((size) => `favicon-${size}x${size}.png`)
  ];

  return {
    appSlug,
    outDir,
    files: generatedFiles
  };
}

export function getMimeType(ext) {
  const map = {
    png: 'image/png',
    webp: 'image/webp',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    avif: 'image/avif',
    gif: 'image/gif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    tiff: 'image/tiff'
  };
  return map[ext] || 'image/png';
}

export function slugifyAppName(name) {
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

export function validateSvg(svgText, inputName = 'input') {
  const trimmed = String(svgText ?? '').trimStart().replace(/^\uFEFF/, '');

  if (!trimmed) {
    throw new Error(`${inputName} is empty.`);
  }

  if (!/<svg(?:\s|>)/i.test(trimmed)) {
    throw new Error(`${inputName} does not look like an SVG document.`);
  }
}

export async function renderPng(svgBuffer, size) {
  return sharp(svgBuffer, { density: 512, limitInputPixels: false })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .ensureAlpha()
    .sharpen(sharpenForSize(size))
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false
    })
    .toBuffer();
}

export function sharpenForSize(size) {
  if (size <= 32) {
    return { sigma: 0.45, m1: 0.5, m2: 1.4, x1: 2, y2: 10, y3: 18 };
  }

  if (size <= 64) {
    return { sigma: 0.35, m1: 0.4, m2: 1.2, x1: 2, y2: 10, y3: 16 };
  }

  return { sigma: 0.3, m1: 0.3, m2: 1, x1: 2, y2: 10, y3: 14 };
}

export function createIco(images) {
  if (!images.length) {
    throw new Error('At least one PNG image is required to create favicon.ico.');
  }

  const headerSize = 6;
  const directoryEntrySize = 16;
  const directorySize = headerSize + images.length * directoryEntrySize;
  const totalSize = directorySize + images.reduce((sum, image) => sum + image.buffer.length, 0);
  const ico = Buffer.alloc(totalSize);

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(images.length, 4);

  let imageOffset = directorySize;

  images.forEach((image, index) => {
    if (image.size < 1 || image.size > 256) {
      throw new Error(`ICO image size must be between 1 and 256. Received ${image.size}.`);
    }

    const entryOffset = headerSize + index * directoryEntrySize;
    const dimension = image.size === 256 ? 0 : image.size;

    ico.writeUInt8(dimension, entryOffset);
    ico.writeUInt8(dimension, entryOffset + 1);
    ico.writeUInt8(0, entryOffset + 2);
    ico.writeUInt8(0, entryOffset + 3);
    ico.writeUInt16LE(1, entryOffset + 4);
    ico.writeUInt16LE(32, entryOffset + 6);
    ico.writeUInt32LE(image.buffer.length, entryOffset + 8);
    ico.writeUInt32LE(imageOffset, entryOffset + 12);

    image.buffer.copy(ico, imageOffset);
    imageOffset += image.buffer.length;
  });

  return ico;
}

export function createManifest(appName) {
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

export function createBrowserConfig() {
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

export function createHtmlTags(appSlug) {
  const assetPath = `/${appSlug}-favicon`;

  return `<link rel="icon" href="${assetPath}/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="${assetPath}/favicon.svg">
<link rel="apple-touch-icon" href="${assetPath}/apple-touch-icon.png">
<link rel="manifest" href="${assetPath}/site.webmanifest">
<meta name="msapplication-config" content="${assetPath}/browserconfig.xml">
<meta name="theme-color" content="#ffffff">
`;
}
