const express = require('express');
const router = express.Router();
const { askJson } = require('../lib/claude');

const PERFIL = `Dra. Roseli Perfoll - Ginecologista especializada em longevidade feminina, Balneario Camboriu SC. Publico-alvo: mulheres 45-70 anos. Tom: acolhedor, cientifico e empoderador. CFM: sem promessas de cura, usar "pode contribuir", "evidencias sugerem", "estudos indicam".`;

// POST /api/content/calendar
router.post('/calendar', async (req, res) => {
    const { month, year, focus } = req.body;
    if (!month || !year) {
          return res.status(400).json({ error: 'Informe month e year.' });
    }
    const userMessage = `Crie um calendario editorial de Instagram para ${month}/${year}.
    Foco especial: ${focus || 'longevidade feminina geral'}.
    Perfil: ${PERFIL}
    Retorne JSON: { "calendar": [ { "day": 1, "tema": "...", "formato": "carrossel|reels|foto", "legenda_curta": "..." } ] }
    Gere entre 12 e 16 posts para o mes.`;
    try {
          const result = await askJson(userMessage, 'Voce e estrategista de conteudo medico. Retorne APENAS JSON valido em portugues do Brasil.');
          res.json(result);
    } catch (err) {
          console.error('[content/calendar] Erro:', err.message);
          res.status(500).json({ error: err.message || 'Erro ao gerar calendario.' });
    }
});

// POST /api/content/caption
router.post('/caption', async (req, res) => {
    const { tema, formato, plataforma } = req.body;
    if (!tema) {
          return res.status(400).json({ error: 'Informe o tema do post.' });
    }
    const formatoFinal = formato || 'carrossel';
    const plataformaFinal = plataforma || 'instagram';
    const userMessage = `Crie uma legenda otimizada para ${plataformaFinal} sobre: "${tema}".
    Formato do post: ${formatoFinal}.
    Perfil: ${PERFIL}
    Retorne JSON: { "caption": "legenda completa com emojis e hashtags", "meta": { "tema": "...", "formato": "...", "plataforma": "..." } }`;
    try {
          const result = await askJson(userMessage, 'Voce e copywriter especializado em marketing medico. Retorne APENAS JSON valido em portugues do Brasil.');
          if (!result.meta) result.meta = {};
          result.meta.tema = tema;
          result.meta.formato = formatoFinal;
          result.meta.plataforma = plataformaFinal;
          res.json(result);
    } catch (err) {
          console.error('[content/caption] Erro:', err.message);
          res.status(500).json({ error: err.message || 'Erro ao gerar legenda.' });
    }
});

// POST /api/content/expand-carousel
router.post('/expand-carousel', async (req, res) => {
    const { tema, slides } = req.body;
    if (!tema) {
          return res.status(400).json({ error: 'Informe o tema do carrossel.' });
    }
    const slidesCount = slides || 7;
    const userMessage = `Crie um carrossel de Instagram com ${slidesCount} slides sobre: "${tema}".
    Perfil: ${PERFIL}
    Retorne JSON: { "slides": [ { "numero": 1, "titulo": "...", "texto": "...", "cta": "..." } ] }
    Slide 1: capa impactante. Ultimos slides: CTA e contato.`;
    try {
          const result = await askJson(userMessage, 'Voce e criador de conteudo medico. Retorne APENAS JSON valido em portugues do Brasil.');
          if (!Array.isArray(result.slides)) {
                  return res.status(500).json({ error: 'Resposta invalida: slides ausentes.' });
          }
          res.json(result);
    } catch (err) {
          console.error('[content/expand-carousel] Erro:', err.message);
          res.status(500).json({ error: err.message || 'Erro ao expandir carrossel.' });
    }
});
module.exports = router;
module.exports = router;
