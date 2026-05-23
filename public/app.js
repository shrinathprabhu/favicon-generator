const form = document.querySelector('#generator-form');
const statusEl = document.querySelector('#status');
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  statusEl.textContent = 'Generating...';

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      body: new FormData(form)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const filename = getDownloadFilename(response.headers.get('content-disposition'));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    statusEl.textContent = `Downloaded ${filename}`;
  } catch (error) {
    statusEl.textContent = error.message || 'Generation failed.';
  } finally {
    submitButton.disabled = false;
  }
});

function getDownloadFilename(contentDisposition) {
  const fallback = 'favicon-assets.zip';
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}
