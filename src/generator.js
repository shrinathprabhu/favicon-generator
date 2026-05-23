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

export async function generateFaviconAssetsFromFile({ inputPath, appName, outRoot = process.cwd() }) {
  const resolvedInput = path.resolve(inputPath);

  if (path.extname(resolvedInput).toLowerCase() !== '.svg') {
    throw new Error('Input must be an .svg file. Other image formats are intentionally rejected.');
  }

  const svgText = await fs.readFile(resolvedInput, 'utf8');
  return generateFaviconAssets({ svgText, appName, outRoot, sourceName: resolvedInput });
}

export async function generateFaviconAssets({ svgText, appName, outRoot = process.cwd(), sourceName = 'uploaded file' }) {
  validateSvg(svgText, sourceName);

  const appSlug = slugifyAppName(appName);
  const outDir = path.join(path.resolve(outRoot), `${appSlug}-favicon`);
  const svgBuffer = Buffer.from(svgText);

  await fs.mkdir(outDir, { recursive: true });

  const pngBuffers = new Map();
  for (const size of PNG_SIZES) {
    const buffer = await renderPng(svgBuffer, size);
    pngBuffers.set(size, buffer);
    await fs.writeFile(path.join(outDir, `favicon-${size}x${size}.png`), buffer);
  }

  for (const icon of PLATFORM_ICONS) {
    const buffer = await renderPng(svgBuffer, icon.size);
    await fs.writeFile(path.join(outDir, icon.name), buffer);
  }

  const icoBuffers = [];
  for (const size of ICO_SIZES) {
    icoBuffers.push({ size, buffer: pngBuffers.get(size) ?? await renderPng(svgBuffer, size) });
  }

  await fs.writeFile(path.join(outDir, 'favicon.ico'), createIco(icoBuffers));
  await fs.writeFile(path.join(outDir, 'original.svg'), svgText);
  await fs.writeFile(path.join(outDir, 'favicon.svg'), svgText);
  await fs.writeFile(path.join(outDir, 'site.webmanifest'), createManifest(appName));
  await fs.writeFile(path.join(outDir, 'browserconfig.xml'), createBrowserConfig());
  await fs.writeFile(path.join(outDir, 'html-tags.txt'), createHtmlTags(appSlug));

  return {
    appSlug,
    outDir,
    files: GENERATED_FILES
  };
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
