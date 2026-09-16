import { encodePng } from './png-encoder.js';

self.onmessage = async ({ data: { id, imageData, compact } }) => {
  try {
    const blob = await encodePng(imageData, compact);
    self.postMessage({ id, blob });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'PNG compression failed.' });
  }
};
