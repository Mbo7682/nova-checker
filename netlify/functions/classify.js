const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

exports.handler = async function(event) {
  try {
    const { text } = JSON.parse(event.body || '{}');
    if (!text) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const prompt = `
Du er en NOVA-klassifikationsassistent.
Returnér KUN et JSON-objekt:
{"category":1|2|3|4,"description":"kort sætning på dansk hvorfor."}

Ingrediensliste:
${text}
`.trim();

    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Du klassificerer fødevarer i NOVA 1–4 og svarer kort på dansk.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    };

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      return { statusCode: response.status, body: JSON.stringify({ error: txt }) };
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[\s\S]*\}/);
    let result;
    if (match) {
      try {
        result = JSON.parse(match[0]);
      } catch {
        result = { category: null, description: content.trim() };
      }
    } else {
      result = { category: null, description: content.trim() || 'Kunne ikke udtrække resultat.' };
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Server error' }) };
  }
};
