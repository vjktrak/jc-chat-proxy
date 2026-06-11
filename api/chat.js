// Catalogo via scraping ld+json - sem token necessario
// Cache em memoria renovado a cada 23h
let catalogCache = null;
let catalogCacheTime = 0;
const CACHE_TTL = 23 * 60 * 60 * 1000;

async function scrapCatalog() {
  const STORE = 'https://www.usejulianacastilho.com';
    const paginas = ['/brincos/', '/colares/', '/pulseiras/', '/dia-dos-namorados/', '/produtos/'];
      const seen = new Set();
        const produtos = [];
          for (const pg of paginas) {
              try {
                    const res = await fetch(STORE + pg, { headers: { 'User-Agent': 'JC-Chat-Proxy/2.0' } });
                          if (!res.ok) continue;
                                const html = await res.text();
                                      const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
                                            let m;
                                                  while ((m = re.exec(html)) !== null) {
                                                          try {
                                                                    const d = JSON.parse(m[1]);
                                                                              if (d['@type'] === 'Product' && d.name && d.mainEntityOfPage?.['@id']) {
                                                                                          const url = d.mainEntityOfPage['@id'].replace('https://usejulianacastilho.com', STORE);
                                                                                                      if (seen.has(url)) continue;
                                                                                                                  seen.add(url);
                                                                                                                              const pr = d.offers?.price || (Array.isArray(d.offers) ? d.offers[0]?.price : 0) || 0;
                                                                                                                                          produtos.push({ nome: d.name, preco: parseFloat(pr) || 0, url });
                                                                                                                                                    }
                                                                                                                                                            } catch(e) {}
                                                                                                                                                                  }
                                                                                                                                                                      } catch(e) {}
                                                                                                                                                                        }
                                                                                                                                                                          return produtos;
                                                                                                                                                                          }

                                                                                                                                                                          async function buildSystemPrompt() {
                                                                                                                                                                            const now = Date.now();
                                                                                                                                                                              if (catalogCache && (now - catalogCacheTime) < CACHE_TTL) return catalogCache;
                                                                                                                                                                                let produtos = [];
                                                                                                                                                                                  try { produtos = await scrapCatalog(); } catch(e) { console.error('Scraping:', e); }
                                                                                                                                                                                    const lista = produtos.length > 0
                                                                                                                                                                                        ? produtos.map(p => `- ${p.nome}${p.preco ? ' - R$' + p.preco.toFixed(2).replace('.', ',') : ''} - ${p.url}`).join('\n')
                                                                                                                                                                                            : '(catalogo indisponivel no momento)';
                                                                                                                                                                                              const prompt = `Voce e Julia, consultora virtual de semijoias da Juliana Castilho Semijoias.

                                                                                                                                                                                              REGRA ABSOLUTA - NUNCA INVENTE PRODUTOS:
                                                                                                                                                                                              Voce tem o CATALOGO OFICIAL abaixo. Estas sao as UNICAS pecas que existem na loja.
                                                                                                                                                                                              E ESTRITAMENTE PROIBIDO:
                                                                                                                                                                                              - Inventar, criar ou mencionar qualquer produto fora desta lista.
                                                                                                                                                                                              - Sugerir produtos parecidos que nao estejam na lista.
                                                                                                                                                                                              - Criar URLs diferentes das listadas.
                                                                                                                                                                                              - Mencionar precos diferentes dos listados.
                                                                                                                                                                                              Se a cliente pedir algo que nao existe: diga honestamente que nao temos e sugira alternativas reais.
                                                                                                                                                                                              Esta regra tem PRIORIDADE ABSOLUTA.

                                                                                                                                                                                              CATALOGO OFICIAL (${produtos.length} produtos - atualizado automaticamente):
                                                                                                                                                                                              ${lista}

                                                                                                                                                                                              DIFERENCIAIS: 12x cartao / 3x sem juros / 10% Pix / Frete gratis R$399+ / Garantia 1 ano
                                                                                                                                                                                              WhatsApp: (49) 99997-8012

                                                                                                                                                                                              COMO RECOMENDAR:
                                                                                                                                                                                              1. Somente produtos desta lista, nome e URL exatos.
                                                                                                                                                                                              2. Formato: **[Nome]** - R$XX,XX - [link]
                                                                                                                                                                                              3. Maximo 3 produtos por resposta.
                                                                                                                                                                                              4. Explique por que combina com o pedido.
                                                                                                                                                                                              5. Se nao houver produto adequado, diga honestamente.

                                                                                                                                                                                              TOM: acolhedora, elegante, feminina. Portugues brasileiro. Respostas curtas (max 3 paragrafos).`;
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
                                                                                                                                                                                                                                  model: model || 'claude-haiku-4-5-20251001',
                                                                                                                                                                                                                                        max_tokens: max_tokens || 600,
                                                                                                                                                                                                                                              messages,
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
                                                                                                                                                                                                                                                                                                                        const replyText = data.content?.[0]?.text || '';
                                                                                                                                                                                                                                                                                                                            return res.status(response.status).json({ reply: replyText, ...data });
                                                                                                                                                                                                                                                                                                                              } catch (error) {
                                                                                                                                                                                                                                                                                                                                  console.error('Erro no proxy:', error);
                                                                                                                                                                                                                                                                                                                                      return res.status(500).json({ error: 'Erro interno do servidor' });
                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                        }