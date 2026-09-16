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

export async function encodePng(imageData, compact) {
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
