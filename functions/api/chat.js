export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const userText = (body.prompt || '').trim();
  const wakeWord = body.wakeWord || 'Jarvis';
  if (!userText) {
    return new Response(JSON.stringify({ reply: 'कुछ बोलिए बॉस, मैं सुन रहा हूँ!' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt = `You are ${wakeWord}, a warm, smart, human-like personal AI assistant. Reply concisely in 1 to 2 natural sentences. Automatically match the user's exact language (Hindi, Hinglish, English, or Punjabi) and speaking style/tone (casual, desi, tapori, or formal).`;

  // 1. Try Gemini first if GEMINI_API_KEY is set in Cloudflare Environment Variables
  if (env.GEMINI_API_KEY) {
    try {
      const gemUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      const gemResp = await fetch(gemUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }]
        })
      });
      if (gemResp.ok) {
        const gemData = await gemResp.json();
        const gemText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (gemText) {
          return new Response(JSON.stringify({ reply: gemText.trim(), provider: 'gemini' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (e) {
      // Fall through to Cloudflare Llama AI
    }
  }

  // 2. Auto-Fallback to Cloudflare Workers AI (Llama 3.1) - 100% Free, No API Key needed
  if (env.AI) {
    try {
      const aiResp = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        max_tokens: 180
      });
      const llamaText = aiResp?.response;
      if (llamaText) {
        return new Response(JSON.stringify({ reply: llamaText.trim(), provider: 'llama' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (e) {
      // Fall through to graceful message
    }
  }

  return new Response(JSON.stringify({
    reply: `मैंने "${userText}" सुना बॉस! कृपया Cloudflare में AI बाइंडिंग या GEMINI_API_KEY सेट करें।`,
    provider: 'fallback'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
