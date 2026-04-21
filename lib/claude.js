const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

/**
 * Get or create Anthropic client singleton
 * @returns {Anthropic} Anthropic client instance
 */
function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY nao configurada.');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Send a message to Claude and get text response
 * @param {string} userMessage - The user's message
 * @param {string} systemPrompt - System prompt to guide the AI
 * @param {Object} opts - Optional parameters (model, maxTokens)
 * @returns {Promise<string>} Text response from Claude
 */
async function ask(userMessage, systemPrompt, opts = {}) {
  const client = getClient();
  
  const response = await client.messages.create({
    model: opts.model || 'claude-sonnet-4-6',
    max_tokens: opts.maxTokens || 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error('Claude nao retornou conteudo');
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  if (!text) {
    throw new Error('Claude retornou conteudo vazio');
  }

  return text;
}

/**
 * Send a message to Claude and parse JSON response
 * @param {string} userMessage - The user's message
 * @param {string} systemPrompt - System prompt to guide the AI
 * @param {Object} opts - Optional parameters (model, maxTokens)
 * @returns {Promise<Object>} Parsed JSON object from Claude's response
 */
async function askJson(userMessage, systemPrompt, opts = {}) {
  const raw = await ask(userMessage, systemPrompt, opts);
  
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Nenhum objeto JSON encontrado na resposta do Claude');
  }

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error('JSON invalido na resposta do Claude: ' + e.message);
  }
}

module.exports = { ask, askJson };
