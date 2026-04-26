const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CLIENT_FILE = path.join(__dirname, '../data/client.json');

function readClient() {
  try {
    return JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf-8'));
  } catch (e) {
    return { nome: '', especialidade: '', cidade: '', loraId: '', loraStatus: 'pendente' };
  }
}

function writeClient(data) {
  fs.mkdirSync(path.dirname(CLIENT_FILE), { recursive: true });
  fs.writeFileSync(CLIENT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// =============================================
// GET /api/client
// Retorna dados do cliente atual
// =============================================
router.get('/', (req, res) => {
  res.json(readClient());
});

// =============================================
// POST /api/client
// Atualiza dados do cliente (nome, especialidade, etc.)
// Body: { nome, especialidade, cidade, instagram, publico, concorrentes, tom, arquetipo, paleta, evitar, historico }
// =============================================
router.post('/', (req, res) => {
  const current = readClient();
  const s = req.body;
  // Mescla profunda de identidade_visual: preserva campos não enviados
  const ivCurrent = current.identidade_visual || {};
  const ivIncoming = s.identidade_visual || {};
  const identidade_visual = {
    bg_escuro:    ivIncoming.bg_escuro    !== undefined ? ivIncoming.bg_escuro    : ivCurrent.bg_escuro    || '',
    bg_claro:     ivIncoming.bg_claro     !== undefined ? ivIncoming.bg_claro     : ivCurrent.bg_claro     || '',
    acento:       ivIncoming.acento       !== undefined ? ivIncoming.acento       : ivCurrent.acento       || '',
    texto:        ivIncoming.texto        !== undefined ? ivIncoming.texto        : ivCurrent.texto        || '',
    muted:        ivIncoming.muted        !== undefined ? ivIncoming.muted        : ivCurrent.muted        || '',
    fonte_titulo: ivIncoming.fonte_titulo !== undefined ? ivIncoming.fonte_titulo : ivCurrent.fonte_titulo || '',
    fonte_corpo:  ivIncoming.fonte_corpo  !== undefined ? ivIncoming.fonte_corpo  : ivCurrent.fonte_corpo  || '',
    mood:         ivIncoming.mood         !== undefined ? ivIncoming.mood         : ivCurrent.mood         || '',
    negativo:     ivIncoming.negativo     !== undefined ? ivIncoming.negativo     : ivCurrent.negativo     || '',
  };

  const updated = {
    ...current,
    nome:               s.nome          || current.nome,
    especialidade:      s.especialidade || current.especialidade,
    cidade:             s.cidade        || current.cidade,
    instagram:          s.instagram     || current.instagram,
    publico:            s.publico       !== undefined ? s.publico       : current.publico,
    concorrentes:       s.concorrentes  !== undefined ? s.concorrentes  : current.concorrentes,
    tom:                s.tom           !== undefined ? s.tom           : current.tom,
    arquetipo:          s.arquetipo     !== undefined ? s.arquetipo     : current.arquetipo,
    paleta:             s.paleta        !== undefined ? s.paleta        : current.paleta,
    evitar:             s.evitar        !== undefined ? s.evitar        : current.evitar,
    historico:          s.historico     !== undefined ? s.historico     : current.historico,
    identidade_visual,
  };
  writeClient(updated);
  res.json({ ok: true, client: updated });
});

// =============================================
// POST /api/client/lora
// Salva o loraId após registro no Freepik
// Body: { loraId }
// =============================================
router.post('/lora', (req, res) => {
  const { loraId } = req.body;
  if (!loraId) return res.status(400).json({ error: 'loraId é obrigatório' });

  const current = readClient();
  const updated = {
    ...current,
    loraId,
    loraStatus: 'ativo',
    registradoEm: new Date().toISOString(),
  };
  writeClient(updated);
  console.log('[client] loraId salvo:', loraId);
  res.json({ ok: true, client: updated });
});

// =============================================
// DELETE /api/client/lora
// Remove o loraId (reset do personagem)
// =============================================
router.delete('/lora', (req, res) => {
  const current = readClient();
  const updated = { ...current, loraId: '', loraStatus: 'pendente', registradoEm: null };
  writeClient(updated);
  res.json({ ok: true });
});

module.exports = router;
