const express = require('express');
const axios = require('axios');
const router = express.Router();
const { askJson } = require('../lib/claude');

const SOCIAL_SYSTEM_PROMPT = `Voce e um analista de inteligencia de redes sociais especializado em marketing medico.
Retorne EXCLUSIVAMENTE um JSON valido com esta estrutura:
{
  "perfil": { "username": "@handle", "nome": "Nome", "plataforma": "instagram", "bio_resumo": "...", "nicho": "...", "seguidores_estimados": "...", "nota_geral": 80 },
    "conteudo": { "tipos_predominantes": [], "frequencia_estimada": "X/semana", "temas_principais": [], "tom_de_voz": "...", "hashtags_recorrentes": [], "pontos_fortes": [], "pontos_fracos": [] },
      "engajamento": { "nivel": "medio", "taxa_estimada": "X%", "observacoes": "..." },
        "oportunidades": ["op1", "op2", "op3"],
          "estrategia_recomendada": "..."
          }
          - Responda em portugues do Brasil. Retorne APENAS o JSON.`;

          router.post('/analyze-profile', async (req, res) => {
            const { platform, username, manualData } = req.body;
              if (!username) return res.status(400).json({ error: 'Informe o username do perfil.' });

                const cleanUsername = username.replace(/^@/, '').trim();
                  const plat = (platform || 'instagram').toLowerCase();
                    let profileData = null;
                      let scrapeMethod = 'claude';

                        if (process.env.APIFY_API_KEY && !manualData) {
                            try {
                                  profileData = await scrapeWithApify(cleanUsername, plat);
                                        scrapeMethod = 'apify';
                                            } catch (err) {
                                                  console.warn('[social] Apify falhou, usando Claude:', err.message);
                                                      }
                                                        }

                                                          let userMessage;
                                                            if (profileData) {
                                                                userMessage = `Analise este perfil de ${plat} com dados reais:\nUsername: @${cleanUsername}\n${JSON.stringify(profileData, null, 2)}`;
                                                                  } else if (manualData) {
                                                                      userMessage = `Analise este perfil de ${plat}:\nUsername: @${cleanUsername}\n${manualData}`;
                                                                        } else {
                                                                            userMessage = `Analise o perfil @${cleanUsername} no ${plat}. Nicho de saude/medicina no Brasil. Insights para agencia da Dra. Roseli Perfoll (ginecologista, longevidade feminina, Balneario Camboriu).`;
                                                                              }

                                                                                try {
                                                                                    const analysis = await askJson(userMessage, SOCIAL_SYSTEM_PROMPT);
                                                                                        if (!analysis.perfil) analysis.perfil = {};
                                                                                            analysis.perfil.username = '@' + cleanUsername;
                                                                                                analysis.perfil.plataforma = plat;
                                                                                                    if (!analysis.conteudo) analysis.conteudo = {};
                                                                                                        if (!analysis.engajamento) analysis.engajamento = {};
                                                                                                            if (!Array.isArray(analysis.oportunidades)) analysis.oportunidades = [];
                                                                                                                res.json({ analysis, meta: { scrapeMethod, platform: plat, username: cleanUsername, analyzedAt: new Date().toISOString() } });
                                                                                                                  } catch (err) {
                                                                                                                      console.error('[social] Erro:', err.message);
                                                                                                                          res.status(500).json({ error: err.message || 'Erro interno.' });
                                                                                                                            }
                                                                                                                            });
                                                                                                                            
                                                                                                                            router.post('/compare', async (req, res) => {
                                                                                                                              const { profiles } = req.body;
                                                                                                                                if (!Array.isArray(profiles) || profiles.length < 2) return res.status(400).json({ error: 'Envie ao menos 2 perfis.' });
                                                                                                                                  const profileList = profiles.map(p => `@${(p.username||'').replace(/^@/,'')} (${p.platform||'instagram'})`).join('\n');
                                                                                                                                    const userMessage = `Compare estes perfis:\n${profileList}\nRetorne JSON: { "comparativo": [...], "vencedor": "@handle", "insights": [], "recomendacao_roseli": "..." }`;
                                                                                                                                      try {
                                                                                                                                          const comparison = await askJson(userMessage, 'Analista de redes sociais. Retorne APENAS JSON em portugues do Brasil.');
                                                                                                                                              res.json({ comparison });
                                                                                                                                                } catch (err) {
                                                                                                                                                    res.status(500).json({ error: err.message || 'Erro ao comparar.' });
                                                                                                                                                      }
                                                                                                                                                      });
                                                                                                                                                      
                                                                                                                                                      async function scrapeWithApify(username, platform) {
                                                                                                                                                        const apiKey = process.env.APIFY_API_KEY;
                                                                                                                                                          if (!apiKey) throw new Error('APIFY_API_KEY nao configurada');
                                                                                                                                                            const actorId = platform === 'linkedin' ? 'curious_coder~linkedin-profile-scraper' : 'apify~instagram-profile-scraper';
                                                                                                                                                              const input = platform === 'linkedin'
                                                                                                                                                                  ? { profileUrls: [`https://www.linkedin.com/in/${username}/`], proxyConfig: { useApifyProxy: true } }
                                                                                                                                                                      : { usernames: [username], resultsLimit: 1 };
                                                                                                                                                                        console.log(`[apify] ${actorId} -> @${username}`);
                                                                                                                                                                          let runResponse;
                                                                                                                                                                            try {
                                                                                                                                                                                runResponse = await axios.post(
                                                                                                                                                                                      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`,
                                                                                                                                                                                            input,
                                                                                                                                                                                                  { headers: { 'Content-Type': 'application/json' }, params: { token: apiKey, timeout: 120, memory: 256 }, timeout: 150000 }
                                                                                                                                                                                                      );
                                                                                                                                                                                                        } catch (err) {
                                                                                                                                                                                                            if (err.response) {
                                                                                                                                                                                                                  const s = err.response.status;
                                                                                                                                                                                                                        if (s === 401) throw new Error('APIFY_API_KEY invalida');
                                                                                                                                                                                                                              if (s === 402) throw new Error('Sem creditos Apify');
                                                                                                                                                                                                                                    if (s === 404) throw new Error('Actor nao encontrado: ' + actorId);
                                                                                                                                                                                                                                          throw new Error('Apify HTTP ' + s);
                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                  if (err.code === 'ECONNABORTED') throw new Error('Timeout Apify');
                                                                                                                                                                                                                                                      throw err;
                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                          if (!runResponse.data || runResponse.data.length === 0) throw new Error('Apify sem dados (perfil privado?)');
                                                                                                                                                                                                                                                            return runResponse.data[0];
                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                            router.get('/health', (req, res) => {
                                                                                                                                                                                                                                                              const hasApify = !!process.env.APIFY_API_KEY;
                                                                                                                                                                                                                                                                res.json({ apify: hasApify, mode: hasApify ? 'scraping-real' : 'claude', keyPreview: hasApify ? process.env.APIFY_API_KEY.slice(0,12)+'...' : 'nao configurada' });
                                                                                                                                                                                                                                                                });
                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                module.exports = router;
