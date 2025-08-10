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
  const ocrTextEl  = document.getElementById('ocrText');
  const resultEl   = document.getElementById('result');
  const statusEl   = document.getElementById('status');
  const processBtn = document.getElementById('processBtn');

  if (!fileInput || !previewImg || !ocrTextEl || !resultEl || !statusEl || !processBtn) {
    console.error('Missing required DOM elements. Check IDs in index.html.');
    return;
  }

  // --- CONFIG ---
  const OPENAI_API_KEY = "[OPENAI API KEY]";
  const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
  const OPENAI_MODEL = "gpt-4o-mini"; // change if needed/available

  function setStatus(msg) { statusEl.textContent = msg; }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    resultEl.textContent = '';
    ocrTextEl.value = '';

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

    const prompt = `
Du er en NOVA-klassifikationsassistent.
Returnér KUN et JSON-objekt:
{"category":1|2|3|4,"description":"kort sætning på dansk hvorfor."}

Ingrediensliste:
${ingredientsText}
`.trim();

    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "Du klassificerer fødevarer i NOVA 1–4 og svarer kort på dansk." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    };

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OpenAI HTTP ${res.status}: ${txt}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { category: null, description: content.trim() || 'Kunne ikke udtrække resultat.' };

    try {
      return JSON.parse(match[0]);
    } catch {
      return { category: null, description: content.trim() };
    }
  }

  processBtn.addEventListener('click', async () => {
    try {
      processBtn.disabled = true;
      setStatus('Forbereder billede…');
      resultEl.textContent = '';
      ocrTextEl.value = '';

      const file = fileInput.files?.[0];
      if (!file) {
        setStatus('Vælg et billede først.');
        return;
      }

      const dataUrl = await readAndDownscale(file);
      const text = (await runOCR(dataUrl)).trim();
      ocrTextEl.value = text;

      const nova = await classifyWithOpenAI(text);
      const cat = nova.category == null ? 'Ukendt' : `NOVA ${nova.category}`;
      resultEl.textContent = `${cat} — ${nova.description || ''}`;
      setStatus('Færdig ✔');
    } catch (err) {
      console.error(err);
      setStatus('Fejl: ' + (err?.message || 'Ukendt fejl'));
      resultEl.textContent = 'Der opstod en fejl. Se konsollen for detaljer.';
    } finally {
      processBtn.disabled = false;
    }
  });
});
