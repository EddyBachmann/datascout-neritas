const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const PROFILES_FILE = path.join(__dirname, '../data/profiles.json');

// Garante que o arquivo existe
function ensureFile() {
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(PROFILES_FILE, '[]', 'utf-8');
  }
}

// GET /api/profiles — retorna todos os perfis
router.get('/', (req, res) => {
  try {
    ensureFile();
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    const profiles = JSON.parse(raw);
    res.json({ profiles: Array.isArray(profiles) ? profiles : [] });
  } catch (e) {
    console.error('[profiles] GET error:', e.message);
    res.json({ profiles: [] });
  }
});

// POST /api/profiles — salva array completo (substituição total)
router.post('/', (req, res) => {
  try {
    const { profiles } = req.body;
    if (!Array.isArray(profiles)) {
      return res.status(400).json({ error: 'profiles deve ser um array' });
    }
    ensureFile();
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
    res.json({ ok: true, count: profiles.length });
  } catch (e) {
    console.error('[profiles] POST error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
