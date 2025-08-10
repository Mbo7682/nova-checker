/* NOVA Inspector Web – full app.js
 * - Danish+English OCR via Tesseract.recognize (no custom worker)
 * - Robust error reporting
 * - Image downscale with Safari/iOS fallback
 * - Safe DOM lifecycle
 * - Minimal JSON parsing of ChatGPT output
 */

document.addEventListener('DOMContentLoaded', () => {
  const fileInput  = document.getElementById('fileInput');
  const previewImg = document.getElementById('preview');
  const resultEl   = document.getElementById('result');
  const statusEl   = document.getElementById('status');
  const processBtn = document.getElementById('processBtn');
  const progressBar = document.getElementById('progressBar');
  const progressFill = progressBar?.firstElementChild;

  if (!fileInput || !previewImg || !resultEl || !statusEl || !processBtn || !progressBar) {
    console.error('Missing required DOM elements. Check IDs in index.html.');
    return;
  }

  // --- CONFIG ---
  // OpenAI key is stored on the server via Netlify env var.
  const OPENAI_FUNCTION = "/.netlify/functions/classify";

  function setStatus(msg) { statusEl.textContent = msg; }

  function updateProgress(p) {
    if (!progressBar || !progressFill) return;
    progressBar.style.display = 'block';
    progressFill.style.width = `${p}%`;
  }

  function resetProgress() {
    if (!progressBar || !progressFill) return;
    progressFill.style.width = '0%';
    progressBar.style.display = 'none';
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    resultEl.textContent = '';

    if (!file) {
      previewImg.style.display = 'none';
      processBtn.disabled = true;
      setStatus('Ingen fil valgt.');
      return;
    }

    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewImg.style.display = 'block';
    processBtn.disabled = false;
    setStatus('Billede klar. Klik “Process”.');
  });

  // Downscale with Safari/iOS fallback
  async function readAndDownscale(file, maxW = 1600, maxH = 1600) {
    // Fast path
    try {
      const bmp = await createImageBitmap(file);
      return drawDownscaled(bmp, maxW, maxH);
    } catch {
      // Safari/iOS fallback
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = url;
        });
        return drawDownscaled(img, maxW, maxH);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function drawDownscaled(source, maxW, maxH) {
      const ratio = Math.min(1, maxW / source.width, maxH / source.height);
      const w = Math.round(source.width * ratio);
      const h = Math.round(source.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
  }

  // OCR using Tesseract.recognize (no custom worker → avoids DataCloneError)
  async function runOCR(dataUrl) {
    setStatus('OCR kører (dan+eng)…');
    const res = await window.Tesseract.recognize(
      dataUrl,
      'dan+eng',
      {
        logger: (m) => {
          if (m?.status) {
            const p = Math.round((m.progress || 0) * 100);
            updateProgress(Math.round(p * 0.8));
            setStatus(`OCR: ${m.status} ${p}%`);
          }
        }
      }
    );
    return res?.data?.text || '';
  }

  // Ask OpenAI to classify into NOVA
  async function classifyWithOpenAI(ingredientsText) {
    setStatus('Spørger ChatGPT om NOVA…');

    const res = await fetch(OPENAI_FUNCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: ingredientsText })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`API HTTP ${res.status}: ${txt}`);
    }

    return await res.json();
  }

  processBtn.addEventListener('click', async () => {
    try {
      processBtn.disabled = true;
      setStatus('Forbereder billede…');
      resultEl.textContent = '';
      updateProgress(0);

      const file = fileInput.files?.[0];
      if (!file) {
        setStatus('Vælg et billede først.');
        return;
      }

      const dataUrl = await readAndDownscale(file);
      const text = (await runOCR(dataUrl)).trim();
      updateProgress(80);

      const nova = await classifyWithOpenAI(text);
      updateProgress(100);
      const emojiMap = { 1: '🥕', 2: '🧂', 3: '🍞', 4: '🏭' };
      const cat = nova.category == null ? 'Ukendt' : `NOVA ${nova.category}`;
      const emoji = emojiMap[nova.category] || '❓';
      resultEl.textContent = `${emoji} ${cat} — ${nova.description || ''}`;
      setStatus('Færdig ✔');
    } catch (err) {
      console.error(err);
      setStatus('Fejl: ' + (err?.message || 'Ukendt fejl'));
      resultEl.textContent = 'Der opstod en fejl. Se konsollen for detaljer.';
    } finally {
      processBtn.disabled = false;
      setTimeout(resetProgress, 500);
    }
  });
});
