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
                    const nome  = (p.name?.pt || p.name?.es || p.name?.en || Object.values(p.name || {})[0] || '').trim();
                    const preco = p.promotional_price || p.price;
                    const precoStr = preco ? `R$${parseFloat(preco).toFixed(2).replace('.', ',')}` : '';
                    const url   = `https://www.usejulianacastilho.com/produtos/${p.handle}/`;
                    const linha = `- ${nome}${precoStr ? ' - ' + precoStr : ''} - ${url}`;
                    const nomeLow = nome.toLowerCase();
                    if (nomeLow.includes('conjunto')) grouped.conjuntos.push(linha);
                    else if (nomeLow.includes('brinco') || nomeLow.includes('trio') || nomeLow.includes('argola')) grouped.brincos.push(linha);
                    else if (nomeLow.includes('colar') || nomeLow.includes('choker')) grouped.colares.push(linha);
                    else grouped.outros.push(linha);
          }

        const parts = [];
          if (grouped.conjuntos.length) parts.push('CONJUNTOS:\n' + grouped.conjuntos.join('\n'));
          if (grouped.brincos.length)   parts.push('BRINCOS:\n'   + grouped.brincos.join('\n'));
          if (grouped.colares.length)   parts.push('COLARES:\n'   + grouped.colares.join('\n'));
          if (grouped.outros.length)    parts.push('OUTROS:\n'    + grouped.outros.join('\n'));
          productLines = parts.join('\n\n');
  } catch (e) {
          console.error('Erro ao buscar catalogo:', e);
          productLines = '(catalogo temporariamente indisponivel)';
  }

  const totalProdutos = productLines.split('\n').filter(l => l.startsWith('-')).length;

  const prompt = `Voce e Julia, consultora virtual de semijoias da Juliana Castilho Semijoias.

  REGRA ABSOLUTA - NUNCA INVENTE PRODUTOS:
  Voce tem o CATALOGO OFICIAL abaixo. Estas sao as UNICAS pecas que existem na loja.
  E ESTRITAMENTE PROIBIDO:
  - Inventar, criar ou mencionar qualquer produto fora desta lista.
  - Sugerir produtos parecidos que nao estejam na lista.
  - Criar URLs diferentes das listadas.
  - Mencionar precos diferentes dos listados.
  Se a cliente pedir algo que nao existe: responda "No momento nao temos esse item. Posso mostrar o que temos?" e sugira alternativas reais da lista.
  Esta regra tem PRIORIDADE ABSOLUTA.

  CATALOGO OFICIAL (${totalProdutos} produtos - atualizado automaticamente):
  ${productLines}

  DIFERENCIAIS DA LOJA:
  - Ate 12x no cartao / 3x sem juros / 10% desconto no Pix
  - Frete gratis acima de R$399 / Garantia 1 ano / Hipoalergenicas
  - WhatsApp: (49) 99997-8012

  COMO RECOMENDAR:
  1. Somente produtos desta lista, nome e URL exatos.
  2. Formato: **[Nome exato]** - R$XX,XX - [link completo]
  3. Maximo 3 produtos por resposta.
  4. Explique por que a peca combina com o pedido.
  5. Se nao houver produto adequado, diga honestamente.

  TOM: acolhedora, elegante, feminina. Portugues brasileiro natural. Respostas curtas (maximo 3 paragrafos).`;

  catalogCache = prompt;
      catalogCacheTime = now;
      return prompt;
}

export default async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
      if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  try {
          const { messages, max_tokens, model } = req.body;
          const systemPrompt = await buildSystemPrompt();

        const payload = {
                  model:      model || 'claude-haiku-4-5-20251001',
                  max_tokens: max_tokens || 600,
                  messages:   messages,
                  system:     systemPrompt,
        };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                              'Content-Type':      'application/json',
                              'x-api-key':         process.env.ANTHROPIC_API_KEY,
                              'anthropic-version': '2023-06-01'
                  },
                  body: JSON.stringify(payload)
        });

        const data = await response.json();
          const replyText = data.content?.[0]?.text || '';
          return res.status(response.status).json({ reply: replyText, ...data });

  } catch (error) {
          console.error('Erro no proxy:', error);
          return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
