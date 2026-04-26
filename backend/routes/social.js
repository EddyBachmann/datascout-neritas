const express = require('express');
const axios = require('axios');
const router = express.Router();
const { askJson } = require('../lib/claude');

// =============================================
// ANÁLISE DE PERFIS DE REDES SOCIAIS
// Usa Apify para scraping real (quando configurado)
// Ou aceita dados manuais para análise com Claude
// =============================================

const SOCIAL_SYSTEM_PROMPT = `Voce e um analista de inteligencia de redes sociais especializado em marketing medico.
Sua missao e analisar um perfil de rede social (Instagram ou LinkedIn) e extrair insights estrategicos.

Retorne EXCLUSIVAMENTE um JSON valido (sem markdown, sem texto extra, sem blocos de codigo) com esta estrutura:
{
  "perfil": {
    "username": "@handle",
    "nome": "Nome do perfil",
    "plataforma": "instagram" ou "linkedin",
    "bio_resumo": "Resumo da bio/descricao do perfil",
    "nicho": "Categoria do perfil (ex: medicina estetica, dermatologia, etc)",
    "seguidores_estimados": "numero ou faixa estimada",
    "nota_geral": numero de 0 a 100
  },
  "conteudo": {
    "tipos_predominantes": ["carrossel", "reels", "foto", "video"],
    "frequencia_estimada": "X posts por semana",
    "temas_principais": ["tema1", "tema2", "tema3", "tema4", "tema5"],
    "tom_de_voz": "Descricao do tom usado (ex: formal e educativo, casual e acessivel)",
    "hashtags_recorrentes": ["#hash1", "#hash2", "#hash3"],
    "pontos_fortes": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
    "pontos_fracos": ["fraqueza 1", "fraqueza 2", "fraqueza 3"]
  },
  "engajamento": {
    "nivel": "alto" ou "medio" ou "baixo",
    "taxa_estimada": "X%",
    "observacoes": "O que se destaca no engajamento deste perfil"
  },
  "oportunidades": [
    "Oportunidade 1 que a Dra. Roseli poderia aproveitar observando este perfil",
    "Oportunidade 2",
    "Oportunidade 3"
  ],
  "estrategia_recomendada": "Resumo de como a Dra. Roseli pode se diferenciar deste concorrente ou aprender com ele"
}

IMPORTANTE:
- Seja honesto — se nao tem dados suficientes, estime com base no que sabe do nicho
- Foque em insights acionaveis para uma agencia de marketing medico
- Responda SEMPRE em portugues do Brasil
- Retorne APENAS o JSON`;

// =============================================
// ROTA 1: POST /api/social/analyze-profile
// Analisa um perfil de rede social
// Body: { platform, username, manualData? }
// =============================================

router.post('/analyze-profile', async (req, res) => {
  const { platform, username, manualData } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Informe o username do perfil.' });
  }

  const cleanUsername = username.replace(/^@/, '').trim();
  const plat = (platform || 'instagram').toLowerCase();

  let profileData = null;
  let scrapeMethod = 'manual';

  // Tenta scraping com Apify se a chave existir
  if (process.env.APIFY_API_KEY && !manualData) {
    try {
      profileData = await scrapeWithApify(cleanUsername, plat);
      scrapeMethod = 'apify';
    } catch (err) {
      console.warn('[social] Apify falhou, usando analise Claude:', err.message);
    }
  }

  // Monta o prompt para Claude
  let userMessage;

  if (profileData) {
    userMessage = `Analise este perfil de ${plat} com base nos dados reais extraidos:

Username: @${cleanUsername}
Plataforma: ${plat}

Dados do perfil:
${JSON.stringify(profileData, null, 2)}

Forneca uma analise completa e estrategica.`;
  } else if (manualData) {
    userMessage = `Analise este perfil de ${plat} com base nas informacoes fornecidas pelo usuario:

Username: @${cleanUsername}
Plataforma: ${plat}

Informacoes fornecidas:
${manualData}

Forneca uma analise completa e estrategica baseada nessas informacoes.`;
  } else {
    userMessage = `Analise o perfil @${cleanUsername} na plataforma ${plat}.

Este e um perfil do nicho de saude/medicina. Com base no seu conhecimento sobre o mercado de conteudo medico em redes sociais no Brasil, faca uma analise estrategica deste perfil.

Se voce conhece esse perfil especifico, use esse conhecimento. Se nao, faca uma analise generica baseada no nicho e formate como se fosse uma primeira analise exploratoria, deixando claro quais pontos sao estimativas.

O objetivo e gerar insights uteis para a agencia de marketing da Dra. Roseli Perfoll (ginecologista especializada em longevidade feminina em Balneario Camboriu).`;
  }

  try {
    const analysis = await askJson(userMessage, SOCIAL_SYSTEM_PROMPT);

    // Normalizar campos
    if (!analysis.perfil) analysis.perfil = {};
    analysis.perfil.username = '@' + cleanUsername;
    analysis.perfil.plataforma = plat;
    if (!analysis.conteudo) analysis.conteudo = {};
    if (!analysis.engajamento) analysis.engajamento = {};
    if (!Array.isArray(analysis.oportunidades)) analysis.oportunidades = [];

    console.log('[social] Analise concluida para @' + cleanUsername);

    res.json({
      analysis,
      meta: {
        scrapeMethod,
        platform: plat,
        username: cleanUsername,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[social] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao analisar perfil.' });
  }
});

// =============================================
// ROTA 2: POST /api/social/compare
// Compara 2+ perfis lado a lado
// Body: { profiles: [{ username, platform }] }
// =============================================

router.post('/compare', async (req, res) => {
  const { profiles } = req.body;

  if (!Array.isArray(profiles) || profiles.length < 2) {
    return res.status(400).json({ error: 'Envie ao menos 2 perfis para comparar.' });
  }

  if (profiles.length > 5) {
    return res.status(400).json({ error: 'Maximo de 5 perfis por comparacao.' });
  }

  const profileList = profiles.map(p => `@${(p.username || '').replace(/^@/, '')} (${p.platform || 'instagram'})`).join('\n');

  const userMessage = `Compare os seguintes perfis de redes sociais lado a lado:

${profileList}

Analise comparativamente: frequencia de publicacao, tipo de conteudo, engajamento, tom de voz, pontos fortes e fracos de cada um.

Retorne EXCLUSIVAMENTE um JSON com esta estrutura:
{
  "comparativo": [
    {
      "username": "@handle",
      "plataforma": "instagram",
      "nota": 0-100,
      "frequencia": "X/semana",
      "engajamento": "alto/medio/baixo",
      "ponto_forte": "principal ponto forte",
      "ponto_fraco": "principal fraqueza"
    }
  ],
  "vencedor": "@handle que mais se destaca",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recomendacao_roseli": "Como a Dra. Roseli pode se posicionar frente a esses concorrentes"
}`;

  try {
    const comparison = await askJson(
      userMessage,
      'Voce e um analista de redes sociais. Retorne APENAS JSON valido em portugues do Brasil.'
    );
    res.json({ comparison });
  } catch (err) {
    console.error('[social/compare] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao comparar perfis.' });
  }
});

// =============================================
// HELPER: Scraping com Apify
// =============================================

async function scrapeWithApify(username, platform) {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) throw new Error('APIFY_API_KEY nao configurada');

  // Actors validados do Apify Store
  const actorId = platform === 'linkedin'
    ? 'curious_coder~linkedin-profile-scraper'
    : 'apify~instagram-profile-scraper';

  const input = platform === 'linkedin'
    ? {
        profileUrls: [`https://www.linkedin.com/in/${username}/`],
        proxyConfig: { useApifyProxy: true },
      }
    : {
        usernames: [username],
        resultsLimit: 1,
      };

  console.log(`[apify] Iniciando scraping: ${actorId} para @${username}`);

  let runResponse;
  try {
    runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items`,
      input,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          token: apiKey,
          timeout: 120,
          memory: 256,
        },
        timeout: 150000, // 2.5 min local timeout
      }
    );
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const msg = err.response.data?.error?.message || err.response.statusText;
      if (status === 401) throw new Error('APIFY_API_KEY invalida ou sem permissao');
      if (status === 402) throw new Error('Conta Apify sem creditos suficientes');
      if (status === 404) throw new Error(`Actor "${actorId}" nao encontrado no Apify`);
      throw new Error(`Apify HTTP ${status}: ${msg}`);
    }
    if (err.code === 'ECONNABORTED') throw new Error('Timeout: Apify demorou mais que 150s');
    throw err;
  }

  if (!runResponse.data || runResponse.data.length === 0) {
    throw new Error('Apify nao retornou dados para este perfil (perfil privado ou inexistente?)');
  }

  console.log(`[apify] Dados recebidos: ${JSON.stringify(runResponse.data[0]).length} chars`);
  return runResponse.data[0];
}

// =============================================
// HEALTH: GET /api/social/health
// =============================================

router.get('/health', (req, res) => {
  const hasApify = !!process.env.APIFY_API_KEY;
  res.json({
    apify: hasApify,
    mode: hasApify ? 'scraping-real' : 'analise-claude',
    actors: {
      instagram: 'apify~instagram-profile-scraper',
      linkedin: 'curious_coder~linkedin-profile-scraper',
    },
    keyPreview: hasApify
      ? `${process.env.APIFY_API_KEY.slice(0, 12)}...`
      : 'nao configurada',
  });
});

module.exports = router;
