export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const userText = (body.prompt || '').trim();
  const wakeWord = body.wakeWord || 'Jarvis';
  if (!userText) {
    return new Response(JSON.stringify({ reply: 'कुछ बोलिए बॉस, मैं सुन रहा हूँ!' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const systemPrompt = `You are ${wakeWord}, a warm, smart, human-like personal AI assistant. Reply concisely in 1 to 2 natural sentences. Match the user's exact language (Hindi, Hinglish, English, or Punjabi) and tone.`;
  let gemErr = 'no_key';
  const key = (env.GEMINI_API_KEY || '').trim();

  if (key) {
    for (const model of ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3-flash-preview']) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userText }] }]
          })
        });
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return new Response(JSON.stringify({ reply: text.trim(), provider: model }), { headers: { 'Content-Type': 'application/json' } });
        gemErr = data?.error?.message || `status_${resp.status}`;
      } catch (e) { gemErr = e.message; }
    }
  }

  let llamaErr = 'no_ai_binding';
  if (env.AI) {
    for (const cfModel of ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-3.2-11b-vision-instruct']) {
      try {
        const aiResp = await env.AI.run(cfModel, {
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
          max_tokens: 180
        });
        if (aiResp?.response) return new Response(JSON.stringify({ reply: aiResp.response.trim(), provider: cfModel }), { headers: { 'Content-Type': 'application/json' } });
      } catch (e) { llamaErr = e.message; }
    }
  }

  return new Response(JSON.stringify({ reply: `AI Error -> Gemini: ${gemErr} | Llama: ${llamaErr}` }), { headers: { 'Content-Type': 'application/json' } });
}
