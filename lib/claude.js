const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY nao configurada.');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

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
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text) throw new Error('Claude retornou conteudo vazio');
  return text;
}

async function askJson(userMessage, systemPrompt, opts = {}) {
  const raw = await ask(userMessage, systemPrompt, opts);
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
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
