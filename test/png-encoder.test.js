import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { encodePng } from '../public/og-image/png-encoder.js';

function imageData(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set([...pixel(x, y), 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

async function decode(source, compact) {
  const blob = await encodePng(source, compact);
  assert.equal(blob.type, 'image/png');
  const png = Buffer.from(await blob.arrayBuffer());
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, source.width);
  assert.equal(info.height, source.height);
  return { png, data };
}

test('lossless PNG preserves every pixel', async () => {
  const source = imageData(97, 63, (x, y) => [(x * 7) % 256, (y * 11) % 256, (x + y) % 256]);
  const { png, data } = await decode(source, false);
  assert.equal(png[25], 2, 'truecolor PNG');
  assert.deepEqual(data, Buffer.from(source.data));
});

test('compact PNG preserves a small palette exactly', async () => {
  const source = imageData(48, 32, (x, y) => (x + y) % 2 ? [20, 108, 67] : [255, 255, 255]);
  const { png, data } = await decode(source, true);
  assert.equal(png[25], 3, 'indexed PNG');
  assert.deepEqual(data, Buffer.from(source.data));
});

test('compact PNG quantizes gradients with bounded color error', async () => {
  const source = imageData(128, 96, (x, y) => [x * 2, Math.round(y * 255 / 95), Math.round((x + y) * 255 / 222)]);
  const { png, data } = await decode(source, true);
  assert.equal(png[25], 3, 'indexed PNG');
  let error = 0;
  for (let i = 0; i < data.length; i += 1) error += (data[i] - source.data[i]) ** 2;
  assert.ok(Math.sqrt(error / data.length) < 10, 'gradient RMS error stays below 10/255');
});
