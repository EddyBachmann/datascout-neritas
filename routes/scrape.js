const express = require('express');
const axios = require('axios');
const router = express.Router();

router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'URL inválida. Use uma URL completa (ex: https://exemplo.com).' });
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    return res.status(500).json({ error: 'Chave da API Firecrawl não configurada no servidor.' });
  }

  try {
    const response = await axios.post(
      'https://api.firecrawl.dev/v1/scrape',
      {
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;

    if (!data.success) {
      return res.status(422).json({ error: 'O Firecrawl não conseguiu processar esta página.' });
    }

    const content = data.data?.markdown || '';
    const title = data.data?.metadata?.title || url;

    if (!content || content.trim().length < 50) {
      return res.status(422).json({ error: 'Pouco conteúdo extraído. Tente outra URL ou verifique se o site permite acesso.' });
    }

    const truncated = content.length > 100000 ? content.slice(0, 100000) + '\n\n[... conteúdo truncado ...]' : content;

    res.json({ content: truncated, title, url });
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401) return res.status(401).json({ error: 'Chave Firecrawl inválida ou expirada.' });
      if (status === 429) return res.status(429).json({ error: 'Limite de requisições do Firecrawl atingido. Aguarde e tente novamente.' });
      return res.status(status).json({ error: `Erro do Firecrawl: ${err.response.data?.error || status}` });
    }
    if (err.code === 'ECONNABORTED') return res.status(408).json({ error: 'Tempo esgotado ao acessar o site. Tente novamente.' });
    console.error('Erro no scrape:', err.message);
    res.status(500).json({ error: 'Erro interno ao coletar dados.' });
  }
});

module.exports = router;

