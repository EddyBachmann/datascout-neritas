
const express = require('express');
const router = express.Router();

// ============================================
// PERFIL DA DRA. ROSELI — injetado em todos os prompts
// ============================================

const ROSELI_PROFILE = `
PERFIL DA MÉDICA (contexto fixo — use sempre):
- Nome: Dra. Roseli
- Especialidade: Ginecologista com foco em longevidade feminina
- Idade: 66 anos (médica sênior com trajetória consolidada)
- Localização: Balneário Camboriú, SC
- Público-alvo: Mulheres de 45 a 70 anos (perimenopausa, menopausa, pós-menopausa)
- Tom de voz: Acolhedor, científico e empoderador. Nunca alarmista. Usa linguagem acessível sem ser simplista.
- Plataformas: Instagram (prioridade) e LinkedIn
- Pilares de conteúdo: (1) Educação sobre longevidade feminina, (2) Autoridade científica, (3) Conexão emocional com o público, (4) Prova social / cases de transformação, (5) Estilo de vida e bem-estar integral
- Restrições do CFM: Não prometer curas, não usar antes/depois de procedimentos, não fazer propaganda enganosa. Usar sempre linguagem de "pode contribuir para", "evidências sugerem", "converse com seu médico".
- Temas recorrentes: menopausa, reposição hormonal, longevidade, saúde óssea, libido, saúde mental da mulher madura, sono, nutrição anti-aging, movimento e força na maturidade.
`;

// ============================================
// ROTA 1: /api/content/calendar
// Gera calendário editorial mensal completo
// Body: { month, year, platforms, focus (opcional) }
// Retorna: { calendar: [ { semana, dia, tema, pilar, formato, hook, cta, plataforma, hashtags } ] }
// ============================================

const CALENDAR_SYSTEM_PROMPT = `Você é um estrategista de conteúdo especializado em marketing médico para Instagram e LinkedIn.
${ROSELI_PROFILE}

Sua tarefa é gerar um calendário editorial mensal completo e estratégico para a Dra. Roseli.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra, sem blocos de código) com esta estrutura:
{
  "mes_ano": "Abril 2026",
  "total_posts": 20,
  "resumo_estrategico": "Uma frase descrevendo a estratégia do mês",
  "distribuicao_pilares": {
    "educacao": 6,
    "autoridade": 4,
    "conexao_emocional": 4,
    "prova_social": 3,
    "estilo_de_vida": 3
  },
  "posts": [
    {
      "numero": 1,
      "semana": 1,
      "dia_sugerido": "Segunda-feira",
      "plataforma": "Instagram",
      "pilar": "Educação",
      "formato": "Carrossel (6 slides)",
      "tema": "título claro e direto do post",
      "hook": "Primeira linha irresistível do post — deve parar o scroll",
      "desenvolvimento": "O que abordar no corpo do conteúdo (2-3 frases de orientação)",
      "cta": "Chamada para ação específica e natural",
      "hashtags": ["#longevidadefeminina", "#menopausa", "#saúdedamulher"],
      "observacao": "Dica de produção ou timing relevante (opcional)"
    }
  ]
}

REGRAS PARA O CALENDÁRIO:
- 20 posts distribuídos ao longo do mês (4-5 por semana)
- Variar formatos: carrossel, reels, foto com legenda, stories informativos, LinkedIn artigo
- Alternar pilares para não cansar o feed com o mesmo tipo de conteúdo
- Hooks devem ser específicos, não genéricos — mencionar dores reais do público 45-70 anos
- CTAs devem variar: salvar, comentar, compartilhar, agendar consulta, responder pergunta
- Respeitar sempre as restrições do CFM
- Responda em português do Brasil
- Retorne APENAS o JSON\`;`;

router.post('/calendar', async (req, res) => {
  const { month, year, focus } = req.body;

  const monthLabel = month && year ? `${month} de ${year}` : 'próximo mês';
  const focusNote = focus ? `\nFoco especial do mês: ${focus}` : '';

  const userMessage = `Gere o calendário editorial mensal completo para a Dra. Roseli.

Mês de referência: ${monthLabel}${focusNote}

Crie 20 posts estratégicos, bem distribuídos entre os pilares de conteúdo, com variedade de formatos e plataformas (Instagram e LinkedIn). Priorize Instagram (aproximadamente 14 posts) e LinkedIn (aproximadamente 6 posts).`;

  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    let rawResponse = '';

    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt: CALENDAR_SYSTEM_PROMPT,
        allowedTools: [],
        maxTurns: 1,
      },
    })) {
      if (message.type === 'result' && message.subtype === 'success' && message.result) {
        rawResponse = message.result;
      }
    }

    if (!rawResponse) {
      return res.status(500).json({ error: 'Nenhuma resposta gerada. Verifique se o Claude Code está autenticado.' });
    }

    let calendar;
    try {
      const start = rawResponse.indexOf('{');
      const end = rawResponse.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('Nenhum objeto JSON encontrado na resposta');
      }
      calendar = JSON.parse(rawResponse.slice(start, end + 1));
    } catch (parseErr) {
      console.error('[content/calendar] Erro ao parsear JSON:', parseErr.message);
      return res.status(500).json({ error: 'Resposta inválida do Claude. Tente novamente.' });
    }

    // Normalização defensiva
    if (!Array.isArray(calendar.posts)) calendar.posts = [];
    calendar.total_posts = calendar.posts.length;
    calendar.mes_ano = calendar.mes_ano || monthLabel;
    calendar.resumo_estrategico = calendar.resumo_estrategico || '';

    res.json({ calendar });
  } catch (err) {
    const name = err.constructor?.name || '';
    if (name === 'CLINotFoundError') {
      return res.status(500).json({ error: 'Claude Code CLI não encontrado. Instale com: npm install -g @anthropic-ai/claude-code' });
    }
    if (name === 'CLIConnectionError') {
      return res.status(500).json({ error: 'Erro de conexão com o Claude CLI. Execute: claude login' });
    }
    console.error('[content/calendar] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao gerar calendário.' });
  }
});

// ============================================
// ROTA 2: /api/content/caption
// Gera legenda completa para um post
// Body: { tema, formato, plataforma, contexto (opcional), cta_tipo (opcional) }
// Retorna: { caption: { legenda, hashtags, cta, notas_producao } }
// ============================================

const CAPTION_SYSTEM_PROMPT = `Você é um copywriter especializado em marketing médico, com expertise em conteúdo para Instagram e LinkedIn de profissionais de saúde.
${ROSELI_PROFILE}

Sua tarefa é escrever uma legenda completa, no estilo e voz da Dra. Roseli, para o post descrito pelo usuário.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra, sem blocos de código) com esta estrutura:
{
  "legenda": "Texto completo da legenda, com quebras de linha representadas por \\n. Inclua emojis com moderação — máximo 3-4 por legenda, no lugar certo.",
  "hashtags": ["#longevidadefeminina", "#menopausa", "#balneariocamboriu"],
  "cta": "Chamada para ação final (separada da legenda para facilitar edição)",
  "notas_producao": "Sugestões para a foto/vídeo, iluminação, texto na arte ou contexto visual que combinaria com essa legenda"
}

REGRAS DE COPYWRITING PARA A DRA. ROSELI:
- Abertura: primeira linha DEVE parar o scroll — pergunta provocadora, dado surpreendente ou afirmação forte
- Voz: fala de médica que também é mulher madura — empática, não condescendente
- Evitar: "Dr(a) fulano recomenda", jargão clínico excessivo, promessas de resultado
- Usar: "muitas das minhas pacientes", "na minha experiência clínica", "a ciência mostra que"
- Comprimento: Instagram = 150-250 palavras. LinkedIn = 250-400 palavras.
- Hashtags: 8-12 para Instagram, 3-5 para LinkedIn. Misturar amplas e nichadas.
- Responda em português do Brasil
- Retorne APENAS o JSON`;

router.post('/caption', async (req, res) => {
  const { tema, formato, plataforma, contexto, cta_tipo } = req.body;

  if (!tema) {
    return res.status(400).json({ error: 'Campo obrigatório: tema.' });
  }

  const plataformaFinal = plataforma || 'Instagram';
  const formatoFinal = formato || 'Foto com legenda';
  const contextoNote = contexto ? `\nContexto adicional: ${contexto}` : '';
  const ctaNote = cta_tipo ? `\nTipo de CTA desejado: ${cta_tipo}` : '';

  const userMessage = `Escreva a legenda completa para o seguinte post da Dra. Roseli:

Tema: ${tema}
Formato: ${formatoFinal}
Plataforma: ${plataformaFinal}${contextoNote}${ctaNote}

Crie uma legenda no tom acolhedor, científico e empoderador da Dra. Roseli, respeitando as diretrizes do CFM e otimizada para engajamento real do público 45-70 anos.`;

  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    let rawResponse = '';

    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt: CAPTION_SYSTEM_PROMPT,
        allowedTools: [],
        maxTurns: 1,
      },
    })) {
      if (message.type === 'result' && message.subtype === 'success' && message.result) {
        rawResponse = message.result;
      }
    }

    if (!rawResponse) {
      return res.status(500).json({ error: 'Nenhuma resposta gerada. Verifique se o Claude Code está autenticado.' });
    }

    let caption;
    try {
      const start = rawResponse.indexOf('{');
      const end = rawResponse.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('Nenhum objeto JSON encontrado na resposta');
      }
      caption = JSON.parse(rawResponse.slice(start, end + 1));
    } catch (parseErr) {
      console.error('[content/caption] Erro ao parsear JSON:', parseErr.message);
      return res.status(500).json({ error: 'Resposta inválida do Claude. Tente novamente.' });
    }

    // Normalização defensiva
    caption.legenda = caption.legenda || '';
    caption.hashtags = Array.isArray(caption.hashtags) ? caption.hashtags : [];
    caption.cta = caption.cta || '';
    caption.notas_producao = caption.notas_producao || '';

    // Metadados de contexto retornados junto
    res.json({
      caption,
      meta: {
        tema,
        formato: formatoFinal,
        plataforma: plataformaFinal,
      },
    });
  } catch (err) {
    const name = err.constructor?.name || '';
    if (name === 'CLINotFoundError') {
      return res.status(500).json({ error: 'Claude Code CLI não encontrado. Instale com: npm install -g @anthropic-ai/claude-code' });
    }
    if (name === 'CLIConnectionError') {
      return res.status(500).json({ error: 'Erro de conexão com o Claude CLI. Execute: claude login' });
    }
    console.error('[content/caption] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno ao gerar legenda.' });
  }
});

module.exports = router;
