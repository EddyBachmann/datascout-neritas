// =============================================
// Helper: cliente Anthropic SDK
// Substitui o claude-agent-sdk — funciona em
// qualquer servidor sem precisar do CLI local.
// Requer: ANTHROPIC_API_KEY no .env
// =============================================

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY nao configurada. Adicione no .env ou nas env vars do Railway.');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Envia uma mensagem para o Claude e retorna o texto da resposta.
 * @param {string} userMessage  - Mensagem do usuário
 * @param {string} systemPrompt - System prompt
 * @param {object} opts         - Opções extras (model, max_tokens)
 * @returns {Promise<string>}   - Texto da resposta
 */
async function ask(userMessage, systemPrompt, opts = {}) {
  const client = getClient();

  const response = await client.messages.create({
    model:      opts.model     || 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens || 4096,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error('Claude nao retornou conteudo');
  }

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (!text) {
    throw new Error('Claude retornou conteudo vazio');
  }

  return text;
}

/**
 * Sanitiza uma string JSON substituindo quebras de linha literais
 * dentro de valores de string por \n escapado.
 * Isso corrige o caso em que o Claude retorna newlines reais dentro de strings JSON.
 */
function sanitizeJsonString(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escaped) {
      result += ch;
      escaped = false;
    } else if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
    } else if (ch === '"') {
      result += ch;
      inString = !inString;
    } else if (inString && ch === '\n') {
      result += '\\n';
    } else if (inString && ch === '\r') {
      // ignora \r dentro de strings
    } else if (inString && ch === '\t') {
      result += '\\t';
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Chama ask() e faz parse do JSON da resposta.
 * Extrai o primeiro objeto ou array JSON encontrado no texto.
 * Aplica sanitização automática se o parse inicial falhar.
 * @returns {Promise<object|Array>}
 */
async function askJson(userMessage, systemPrompt, opts = {}) {
  const raw = await ask(userMessage, systemPrompt, opts);

  // Detecta se é objeto {} ou array []
  const objStart   = raw.indexOf('{');
  const arrStart   = raw.indexOf('[');
  const useArray   = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  const openChar   = useArray ? '[' : '{';
  const closeChar  = useArray ? ']' : '}';

  const start = raw.indexOf(openChar);
  const end   = raw.lastIndexOf(closeChar);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Nenhum objeto JSON encontrado na resposta do Claude');
  }

  const slice = raw.slice(start, end + 1);

  // Tentativa 1: parse direto
  try {
    return JSON.parse(slice);
  } catch (_) {
    // Tentativa 2: sanitizar newlines literais dentro de strings
    try {
      return JSON.parse(sanitizeJsonString(slice));
    } catch (e2) {
      // Tentativa 3: remover blocos de código markdown e tentar novamente
      const stripped = slice.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      try {
        return JSON.parse(sanitizeJsonString(stripped));
      } catch (e3) {
        throw new Error(`JSON invalido na resposta do Claude: ${e3.message}`);
      }
    }
  }
}

module.exports = { ask, askJson };
