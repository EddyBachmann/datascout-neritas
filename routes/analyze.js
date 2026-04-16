const express = require('express');
const router = express.Router();

const SYSTEM_PROMPT = `Você é um especialista em prospecção B2B para agências de marketing digital.
Sua missão é analisar o conteúdo de um site e identificar o potencial de negócio para uma agência.

Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto extra, sem blocos de código) com esta estrutura:
{
  "empresa": "nome da empresa extraído do site",
  "setor": "setor de atuação · cidade (se identificável)",
  "score": número inteiro de 0 a 100,
  "temperatura": "quente" ou "morno" ou "frio",
  "insight": "uma frase curta e perspicaz resumindo o principal achado (ex: 'Site parado há meses e sem presença em ads — terreno fértil para uma proposta.')",
  "dores": ["problema identificado 1", "problema identificado 2", "problema identificado 3"],
  "abordagem": "roteiro completo de prospecção personalizado para esta empresa, com: abertura personalizada, identificação da dor principal, proposta de valor da agência, pergunta de qualificação e próximos passos"
}

CRITÉRIOS DE SCORE (some os pontos dos critérios que se aplicam ao site analisado):
- Site desatualizado, sem blog ativo ou design claramente antiquado: +20 pontos
- Sem presença em anúncios pagos visíveis (sem menção a Google Ads, Meta Ads, campanhas): +20 pontos
- Formulário quebrado, ausente ou sem CTA claro e convincente: +15 pontos
- Sem links para redes sociais ou redes claramente desatualizadas/abandonadas: +15 pontos
- Sem SEO básico (título genérico, sem meta descrição, sem estrutura de headings): +15 pontos
- Setor onde concorrentes claramente investem mais em marketing digital: +15 pontos

Score 70–100 → temperatura "quente"
Score 40–69 → temperatura "morno"
Score 0–39  → temperatura "frio"

IMPORTANTE:
- Seja honesto na avaliação — nem toda empresa é uma oportunidade quente
- O insight deve ser uma observação perspicaz em linguagem humana, não uma lista de problemas
- A abordagem deve soar natural e personalizada para esta empresa específica, não genérica
- Responda SEMPRE em português do Brasil
- Retorne APENAS o JSON — nenhum texto antes ou depois`;

router.post('/', async (req, res) => {
  console.log('[analyze] req.body:', JSON.stringify(req.body));
  const { content, url, title } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Campo obrigatório: content.' });
  }

  const userMessage = `Analise o seguinte site para prospecção B2B:

URL: ${url || 'não informada'}
Título: ${title || 'não identificado'}

Conteúdo coletado:
${content}`;

  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    let rawResponse = '';

    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt: SYSTEM_PROMPT,
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

    let lead;
    try {
      const start = rawResponse.indexOf('{');
      const end = rawResponse.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('Nenhum objeto JSON encontrado na resposta');
      }
      lead = JSON.parse(rawResponse.slice(start, end + 1));
    } catch (parseErr) {
      console.error('[analyze] Erro ao parsear JSON:', parseErr.message);
      return res.status(500).json({ error: 'Resposta inválida do Claude. Tente novamente.' });
    }

    lead.score = Math.min(100, Math.max(0, parseInt(lead.score) || 0));
    if (!['quente', 'morno', 'frio'].includes(lead.temperatura)) {
      lead.temperatura = lead.score >= 70 ? 'quente' : lead.score >= 40 ? 'morno' : 'frio';
    }
    lead.dores = Array.isArray(lead.dores) ? lead.dores.slice(0, 5) : [];
    lead.empresa = lead.empresa || 'Empresa sem nome';
    lead.setor = lead.setor || 'Setor não identificado';
    lead.insight = lead.insight || '';
    lead.abordagem = lead.abordagem || '';

    res.json({ lead });
  } catch (err) {
    const name = err.constructor?.name || '';
    if (name === 'CLINotFoundError') {
      return res.status(500).json({ error: 'Claude Code CLI não encontrado. Instale com: npm install -g @anthropic-ai/claude-code' });
    }
    if (name === 'CLIConnectionError') {
      return res.status(500).json({ error: 'Erro de conexão com o Claude CLI. Execute: claude login' });
    }
    console.error('Erro na análise:', err.message);
    res.status(500).json({ error: 'Erro interno ao analisar conteúdo.' });
  }
});

module.exports = router;
