export default async function handler(req, res) {
  // Permite apenas o dominio da loja
  const allowedOrigins = [
    'https://www.usejulianacastilho.com',
    'https://julianacastilho.lojavirtualnuvem.com.br'
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
    const { messages, system, max_tokens, model } = req.body;

    const payload = {
            model: model || 'claude-opus-4-5',
                    max_tokens: max_tokens || 1024,
                    messages: messages,
              };

    if (system) {
      payload.system = system;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
      },
            body: JSON.stringify(payload)
      });

    const data = await response.json();
    return res.status(response.status).json(data);

} catch (error) {
    console.error('Erro no proxy:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
}
}
