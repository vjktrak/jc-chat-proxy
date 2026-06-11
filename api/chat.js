// Cache do catalogo em memoria (renovado a cada deploy / 15h via GitHub Actions)
let catalogCache = null;
let catalogCacheTime = 0;
const CACHE_TTL = 23 * 60 * 60 * 1000; // 23 horas

async function buildSystemPrompt() {
    const now = Date.now();
    if (catalogCache && (now - catalogCacheTime) < CACHE_TTL) {
          return catalogCache;
    }

  const storeId = process.env.NUVEMSHOP_STORE_ID;
    const token   = process.env.NUVEMSHOP_ACCESS_TOKEN;

  let productLines = '';

  try {
        let page = 1;
        let allProducts = [];
        while (true) {
                const res = await fetch(
                          `https://api.tiendanube.com/v1/${storeId}/products?per_page=50&page=${page}&fields=name,price,promotional_price,handle,published`,
                  { headers: { 'Authentication': `bearer ${token}`, 'User-Agent': 'JC-Chat-Proxy/1.0' } }
                        );
                if (!res.ok) break;
                const batch = await res.json();
                if (!batch.length) break;
                allProducts = allProducts.concat(batch.filter(p => p.published !== false));
                if (batch.length < 50) break;
                page++;
        }

      const grouped = { conjuntos: [], brincos: [], colares: [], outros: [] };
        for (const p of allProducts) {
                const name = (p.name?.pt || p.name?.es || p.name?.en || Object.values(p.name || {})[0] || '').trim();
                const price = p.promotional_price || p.price;
                const priceStr = price ? `R$${parseFloat(price).toFixed(2).replace('.', ',')}` : '';
                const url = `https://www.usejulianacastilho.com/produtos/${p.handle}`;
                const line = `- ${name}${priceStr ? ' — ' + priceStr : ''} → ${url}`;
                const nameLower = name.toLowerCase();
                if (nameLower.includes('conjunto')) grouped.conjuntos.push(line);
                else if (nameLower.includes('brinco') || nameLower.includes('trio') || nameLower.includes('argola')) grouped.brincos.push(line);
                else if (nameLower.includes('colar') || nameLower.includes('choker')) grouped.colares.push(line);
                else grouped.outros.push(line);
        }

      const parts = [];
        if (grouped.conjuntos.length) parts.push('CONJUNTOS (brinco + colar):\n' + grouped.conjuntos.join('\n'));
        if (grouped.brincos.length)   parts.push('BRINCOS:\n' + grouped.brincos.join('\n'));
        if (grouped.colares.length)   parts.push('COLARES E CHOKERS:\n' + grouped.colares.join('\n'));
        if (grouped.outros.length)    parts.push('OUTROS:\n' + grouped.outros.join('\n'));
        productLines = parts.join('\n\n');
  } catch (e) {
        console.error('Erro ao buscar catalogo:', e);
        productLines = '(catalogo temporariamente indisponivel)';
  }

  const prompt = `Voce e Julia, consultora de semijoias da loja Juliana Castilho Semijoias (usejulianacastilho.com). Voce e acolhedora, elegante e feminina - como uma amiga entendida em moda e joias. Use emojis com moderacao e escreva de forma humana e natural, nunca robotica.

  CATALOGO COMPLETO DA LOJA (atualizado automaticamente):

  ${productLines}

  DIFERENCIAIS DA LOJA:
  - 3x no cartao sem juros | 10% desconto no Pix | Frete gratis acima de R$399 | Garantia de 1 ano | Hipoalergenicas | Envio para todo o Brasil

  REGRAS DE RECOMENDACAO - MUITO IMPORTANTE:
  1. Nunca indique uma categoria generica. Sempre nomeie UMA peca especifica do catalogo acima.
  2. Diga o nome exato, o preco e coloque o link da peca.
  3. Explique de forma genuina e humanizada por que aquela peca combina com o que a cliente pediu - mencione detalhes como a pedra, o acabamento, a versatilidade ou a ocasiao.
  4. Use frases naturais como "esse fica lindo com...", "a pedra turquesa da um toque de...", "e um dos queridinhos da loja porque...".
  5. Nunca pareca forcada. Seja como uma amiga dando uma dica sincera.
  6. Se a cliente quiser ver mais opcoes, sugira no maximo mais 1 ou 2 pecas especificas.

  Responda SEMPRE em portugues brasileiro. Respostas curtas e naturais (maximo 3 paragrafos). Quando perceber abertura, sugira continuar no WhatsApp: 5549999978012.`;

  catalogCache = prompt;
    catalogCacheTime = now;
    return prompt;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
        return res.status(200).end();
  }

  if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  try {
        const { messages, max_tokens, model } = req.body;
        const systemPrompt = await buildSystemPrompt();

      const payload = {
              model: model || 'claude-haiku-4-5-20251001',
              max_tokens: max_tokens || 500,
              messages: messages,
              system: systemPrompt,
      };

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
