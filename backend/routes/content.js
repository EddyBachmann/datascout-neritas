const express = require('express');
const router = express.Router();
const { ask, askJson } = require('../lib/claude');

// =============================================
// PERFIL DA DRA. ROSELI — injetado em todos os prompts
// =============================================

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

// =============================================
// ROTA 1: /api/content/calendar
// Gera calendário editorial mensal completo
// Body: { month, year, platforms, focus (opcional) }
// Retorna: { calendar: [ { semana, dia, tema, pilar, formato, hook, cta, plataforma, hashtags } ] }
// =============================================

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
- Inclua SEMPRE os slides 0 (capa) e 6 (CTA). Os demais são opcionais — só inclua se o conteúdo tiver profundidade suficiente
- Retorne APENAS o JSON`;

router.post('/calendar', async (req, res) => {
  const { month, year, focus } = req.body;

  const monthLabel = month && year ? `${month} de ${year}` : 'próximo mês';
  const focusNote = focus ? `\nFoco especial do mês: ${focus}` : '';

  const userMessage = `Gere o calendário editorial mensal completo para a Dra. Roseli.

Mês de referência: ${monthLabel}${focusNote}

Crie 20 posts estratégicos, bem distribuídos entre os pilares de conteúdo, com variedade de formatos e plataformas (Instagram e LinkedIn). Priorize Instagram (aproximadamente 14 posts) e LinkedIn (aproximadamente 6 posts).`;

  try {
    const calendar = await askJson(userMessage, CALENDAR_SYSTEM_PROMPT, { maxTokens: 8096 });

    // Normalização defensiva
    if (!Array.isArray(calendar.posts)) calendar.posts = [];
    calendar.total_posts = calendar.posts.length;
    calendar.mes_ano = calendar.mes_ano || monthLabel;
    calendar.resumo_estrategico = calendar.resumo_estrategico || '';

    res.json({ calendar });
  } catch (err) {
    console.error('[content/calendar] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao gerar calendário.' });
  }
});

// =============================================
// ROTA 2: /api/content/caption
// Gera legenda completa para um post
// Body: { tema, formato, plataforma, contexto (opcional), cta_tipo (opcional) }
// Retorna: { caption: { legenda, hashtags, cta, notas_producao } }
// =============================================

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
- Inclua SEMPRE os slides 0 (capa) e 6 (CTA). Os demais são opcionais — só inclua se o conteúdo tiver profundidade suficiente
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
    const caption = await askJson(userMessage, CAPTION_SYSTEM_PROMPT);

    // Normalização defensiva
    caption.legenda = caption.legenda || '';
    caption.hashtags = Array.isArray(caption.hashtags) ? caption.hashtags : [];
    caption.cta = caption.cta || '';
    caption.notas_producao = caption.notas_producao || '';

    res.json({
      caption,
      meta: { tema, formato: formatoFinal, plataforma: plataformaFinal },
    });
  } catch (err) {
    console.error('[content/caption] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao gerar legenda.' });
  }
});

// =============================================
// ROTA 3: /api/content/expand-carousel
// Expande 1 ideia do calendário → roteiro completo de 7 slides
// Body: { tema, hook, desenvolvimento, cta, pilar, formato }
// Retorna: { carousel: { tema, pilar, slides: [...] } }
// =============================================

const EXPAND_CAROUSEL_SYSTEM_PROMPT = `Você é um roteirista especializado em carrosséis de Instagram para médicos.
${ROSELI_PROFILE}

Sua tarefa é expandir uma ideia de post em um roteiro de carrossel do Instagram da Dra. Roseli.

O carrossel tem entre 3 e 7 slides. O slide 0 (CAPA) e o slide 6 (CTA) são OBRIGATÓRIOS. Os slides intermediários (ids 1 a 5) são OPCIONAIS — inclua apenas os que o conteúdo justificar. Para temas simples, 3-4 slides bastam. Para temas ricos, use até 7. Inclua apenas os slides necessários.

Slide 0 — CAPA
Slide 1 — PROBLEMA (3 bullets com título + subtítulo cada)
Slide 2 — BOA NOTÍCIA (citação + corpo explicativo)
Slide 3 — COMO FUNCIONA / LISTA (4 items com emoji + título + descrição)
Slide 4 — POR QUÊ / DESTAQUE (3 bullets de apoio)
Slide 5 — PASSOS / COMO FAZER (4 passos numerados)
Slide 6 — CTA FINAL (título + corpo + texto do botão)

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem blocos de código) com esta estrutura:
{
  "tema": "título do carrossel (igual ao tema recebido)",
  "pilar": "pilar de conteúdo",
  "slides": [
    {
      "id": 0,
      "tipo": "capa",
      "tag": "CATEGORIA EM CAPS (ex: LONGEVIDADE FEMININA)",
      "titulo": "Título impactante da capa — pode ter quebras com \\n. Máx 8 palavras.",
      "subtitulo": "Subtítulo curto que gera curiosidade. Máx 12 palavras."
    },
    {
      "id": 1,
      "tipo": "problema",
      "tag": "O PROBLEMA",
      "titulo": "Frase que nomeia o problema central",
      "bullets": [
        { "titulo": "Primeiro ponto do problema", "subtitulo": "Detalhe ou dado concreto" },
        { "titulo": "Segundo ponto do problema", "subtitulo": "Detalhe ou dado concreto" },
        { "titulo": "Terceiro ponto do problema", "subtitulo": "Detalhe ou dado concreto" }
      ]
    },
    {
      "id": 2,
      "tipo": "boa_noticia",
      "tag": "A BOA NOTÍCIA",
      "titulo": "Frase de virada — o que muda com essa informação",
      "citacao": "Frase em primeira pessoa da Dra. Roseli (entre aspas no conteúdo)",
      "corpo": "Explicação em 1-2 frases do que vem a seguir no carrossel"
    },
    {
      "id": 3,
      "tipo": "lista",
      "tag": "TAG DO SLIDE (ex: AS OPÇÕES, OS BENEFÍCIOS)",
      "titulo": "Título do slide de lista",
      "items": [
        { "emoji": "💉", "titulo": "Item 1", "descricao": "Detalhe curto do item 1" },
        { "emoji": "✨", "titulo": "Item 2", "descricao": "Detalhe curto do item 2" },
        { "emoji": "⚡", "titulo": "Item 3", "descricao": "Detalhe curto do item 3" },
        { "emoji": "🔬", "titulo": "Item 4", "descricao": "Detalhe curto do item 4" }
      ]
    },
    {
      "id": 4,
      "tipo": "destaque",
      "tag": "POR QUÊ FUNCIONA",
      "titulo": "Frase que justifica a abordagem",
      "bullets": [
        { "titulo": "Argumento 1", "subtitulo": "Evidência ou dado de apoio" },
        { "titulo": "Argumento 2", "subtitulo": "Evidência ou dado de apoio" },
        { "titulo": "Argumento 3", "subtitulo": "Evidência ou dado de apoio" }
      ]
    },
    {
      "id": 5,
      "tipo": "passos",
      "tag": "COMO COMEÇAR",
      "titulo": "Título dos passos práticos",
      "passos": [
        { "numero": "01", "titulo": "Primeiro passo", "descricao": "Detalhe do passo 1" },
        { "numero": "02", "titulo": "Segundo passo",  "descricao": "Detalhe do passo 2" },
        { "numero": "03", "titulo": "Terceiro passo", "descricao": "Detalhe do passo 3" },
        { "numero": "04", "titulo": "Quarto passo",   "descricao": "Detalhe do passo 4" }
      ]
    },
    {
      "id": 6,
      "tipo": "cta",
      "titulo": "Frase de encerramento empática (2 linhas com \\n)",
      "corpo": "O que o seguidor ganha seguindo a Dra. Roseli. 1-2 frases.",
      "botao": "Texto do botão de CTA (ex: Agende sua consulta →)",
      "handle": "@draroseliperfoll"
    }
  ]
}

REGRAS:
- Linguagem acolhedora, científica e empoderada — voz da Dra. Roseli
- Respeitar sempre restrições do CFM (sem promessas, usar "pode contribuir", "evidências sugerem")
- Textos curtos e diretos — carrossel é lido no celular
- Emojis relevantes para o tema no slide 3
- Responda em português do Brasil
- Inclua SEMPRE os slides 0 (capa) e 6 (CTA). Os demais são opcionais — só inclua se o conteúdo tiver profundidade suficiente
- Retorne APENAS o JSON`;

router.post('/expand-carousel', async (req, res) => {
  const { tema, hook, desenvolvimento, cta, pilar, formato } = req.body;

  if (!tema) {
    return res.status(400).json({ error: 'Campo obrigatorio: tema.' });
  }

  const userMessage = `Expanda esta ideia de post em um carrossel completo de 7 slides:

Tema: ${tema}
${hook ? `Hook: ${hook}` : ''}
${desenvolvimento ? `Desenvolvimento: ${desenvolvimento}` : ''}
${cta ? `CTA: ${cta}` : ''}
${pilar ? `Pilar: ${pilar}` : ''}
${formato ? `Formato original: ${formato}` : ''}

Gere o roteiro completo de 7 slides, adaptando o conteúdo para cada formato de slide conforme as instruções. Mantenha o tom e a voz da Dra. Roseli em todos os slides.`;

  try {
    const carousel = await askJson(userMessage, EXPAND_CAROUSEL_SYSTEM_PROMPT, { maxTokens: 6000 });

    if (!Array.isArray(carousel.slides) || carousel.slides.length < 3 || carousel.slides.length > 7) {
      return res.status(500).json({ error: 'Estrutura de slides invalida. Tente novamente.' });
    }

    res.json({ carousel });
  } catch (err) {
    console.error('[content/expand-carousel] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno ao expandir carrossel.' });
  }
});

// POST /api/content/studio
router.post('/studio', async (req, res) => {
  const { system, user } = req.body;
  if (!user) return res.status(400).json({ error: 'Campo user obrigatorio.' });
  try {
    const text = await ask(user, system || '', { maxTokens: 5000 });
    res.json({ text });
  } catch (err) {
    console.error('[content/studio] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro interno.' });
  }
});


// =============================================
// ROTA 5: /api/content/generate-carousel-package
// Gera pacote [DATASCOUT] pronto para colar no Claude Cowork
// Body: { tema, hook, desenvolvimento, cta, pilar, usePersonagem }
// Retorna: { package: string, hasLora: boolean }
// =============================================

const CAROUSEL_PACKAGE_SYSTEM_PROMPT = `Você é um copywriter especializado em carrosséis de Instagram para médicos.
${ROSELI_PROFILE}

Gere o copy de 7 slides para um carrossel. Retorne APENAS JSON válido, sem markdown, sem texto extra.

{
  "1_hook": "afirmação polêmica ou número que para o scroll — nunca começar com o nome da marca",
  "1_sub": "suporte do hook — 1 linha curta",
  "2_problema": "dor concreta que o público de 45-70 anos reconhece",
  "2_sub": "detalhe ou dado de apoio",
  "3_solucao": "a virada — o que muda com essa informação",
  "3_sub": "como isso se aplica na prática",
  "4_valor1": "benefício concreto e específico 1",
  "4_sub": "suporte",
  "5_valor2": "benefício concreto e específico 2",
  "5_sub": "suporte",
  "6_prova": "dado numérico real ou resultado clínico mensurável",
  "6_sub": "fonte ou contexto",
  "7_cta": "chamada para ação clara e direta",
  "7_sub": "instrução de ação específica"
}

REGRAS:
- Título de cada slide: máximo 8 palavras
- Sub: máximo 12 palavras
- Respeitar CFM: sem promessas de cura, usar "pode contribuir", "evidências sugerem"
- Linguagem acolhedora, técnica sem ser fria, empoderada
- Responda em português do Brasil
- Retorne APENAS o JSON`;

router.post('/generate-carousel-package', async (req, res) => {
  const { tema, hook, desenvolvimento, cta, pilar, usePersonagem } = req.body;
  if (!tema) return res.status(400).json({ error: 'Campo obrigatório: tema.' });

  // Lê client.json para identidade_visual e loraId
  const fs   = require('fs');
  const path = require('path');
  let client = {};
  try {
    client = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/client.json'), 'utf-8'));
  } catch (e) { console.warn('[generate-carousel-package] client.json não encontrado, usando defaults.'); }

  const iv       = client.identidade_visual || {};
  const hasLora  = !!(client.loraId && client.loraId.trim());
  const personagemId = (usePersonagem && hasLora) ? client.loraId : 'nenhum';

  const userMessage = `Gere o copy de 7 slides para um carrossel de Instagram sobre:

Tema: ${tema}
${hook          ? `Hook sugerido: ${hook}`              : ''}
${desenvolvimento ? `Desenvolvimento: ${desenvolvimento}` : ''}
${cta           ? `CTA desejado: ${cta}`               : ''}
${pilar         ? `Pilar de conteúdo: ${pilar}`        : ''}

Público: ${client.publico || 'Mulheres 40–70 anos, longevidade feminina'}
Tom: ${client.tom || 'Acolhedor, técnico sem ser frio, empoderador. Nunca alarmista.'}`;

  try {
    const slides = await askJson(userMessage, CAROUSEL_PACKAGE_SYSTEM_PROMPT, { maxTokens: 1500 });

    // Monta o pacote [DATASCOUT] em formato de texto copiável
    const pkg = [
      '[DATASCOUT]',
      `cliente: ${client.nome || 'Cliente'}`,
      'gerador: Freepik',
      '',
      'identidade_visual:',
      `  bg_escuro:    ${iv.bg_escuro    || '#1A1410'}`,
      `  bg_claro:     ${iv.bg_claro     || '#F5F0E8'}`,
      `  acento:       ${iv.acento       || '#d8c01c'}`,
      `  texto:        ${iv.texto        || '#F5F0E8'}`,
      `  muted:        ${iv.muted        || '#9A8F7A'}`,
      `  fonte_titulo: ${iv.fonte_titulo || 'Blacker Sans Display'}`,
      `  fonte_corpo:  ${iv.fonte_corpo  || 'RoxboroughCF'}`,
      `  mood:         ${iv.mood         || 'medical luxury, feminine authority, elegant'}`,
      `  negativo:     ${iv.negativo     || 'neon, cold whites, casual aesthetics'}`,
      `  personagem:   ${personagemId}`,
      '',
      'slides:',
      `  1_hook:     "${slides['1_hook']     || ''}"`,
      `  1_sub:      "${slides['1_sub']      || ''}"`,
      `  2_problema: "${slides['2_problema'] || ''}"`,
      `  2_sub:      "${slides['2_sub']      || ''}"`,
      `  3_solucao:  "${slides['3_solucao']  || ''}"`,
      `  3_sub:      "${slides['3_sub']      || ''}"`,
      `  4_valor1:   "${slides['4_valor1']   || ''}"`,
      `  4_sub:      "${slides['4_sub']      || ''}"`,
      `  5_valor2:   "${slides['5_valor2']   || ''}"`,
      `  5_sub:      "${slides['5_sub']      || ''}"`,
      `  6_prova:    "${slides['6_prova']    || ''}"`,
      `  6_sub:      "${slides['6_sub']      || ''}"`,
      `  7_cta:      "${slides['7_cta']      || ''}"`,
      `  7_sub:      "${slides['7_sub']      || ''}"`,
    ].join('\n');

    res.json({ package: pkg, hasLora });
  } catch (err) {
    console.error('[content/generate-carousel-package] Erro:', err.message);
    res.status(500).json({ error: err.message || 'Erro ao gerar pacote.' });
  }
});

// POST /api/content/save-carousel-html
// Salva o HTML do carrossel para exportacao via Playwright
router.post('/save-carousel-html', (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'HTML ausente.' });
  const fs = require('fs');
  const path = require('path');
  const dest = path.join(__dirname, '../../frontend/carousel_export.html');
  fs.writeFileSync(dest, html, 'utf-8');
  res.json({ ok: true, path: dest });
});

module.exports = router;
