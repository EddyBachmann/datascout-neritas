const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(UPLOADS_DIR));

/* ─────────────────────────────────────────────────────────
   POST /api/upload-photos
   Recebe fotos base64, salva no servidor, retorna URLs
   ───────────────────────────────────────────────────────── */
app.post('/api/upload-photos', (req, res) => {
  try {
    const { photos, session_id } = req.body;
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'Nenhuma foto recebida.' });
    }
    if (photos.length < 8) {
      return res.status(400).json({ error: 'Minimo 8 fotos necessarias.' });
    }

    const sid = session_id || crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(UPLOADS_DIR, sid);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
      : 'http://localhost:' + PORT;

    const urls = [];
    photos.forEach((b64, i) => {
      const data = b64.replace(/^data:image\/[a-z+]+;base64,/, '');
      const filename = 'foto_' + String(i + 1).padStart(2, '0') + '.jpg';
      const filepath = path.join(sessionDir, filename);
      fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
      urls.push(baseUrl + '/uploads/' + sid + '/' + filename);
    });

    setTimeout(() => {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch(e) {}
    }, 2 * 60 * 60 * 1000);

    console.log('Upload OK: ' + photos.length + ' fotos — sessao ' + sid);
    res.json({ success: true, session_id: sid, urls });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/register-character
   Proxy para Freepik /loras/characters — evita CORS
   O servidor faz a chamada ao Freepik, não o navegador
   ───────────────────────────────────────────────────────── */
app.post('/api/register-character', async (req, res) => {
  try {
    const { fp_key, name, description, quality, gender, images } = req.body;

    if (!fp_key) return res.status(400).json({ error: 'Chave Freepik nao fornecida.' });
    if (!images || images.length < 8) return res.status(400).json({ error: 'Minimo 8 imagens.' });

    const payload = JSON.stringify({
      name: name || 'roseli-perfoll-v2',
      description: description || 'Dra. Roseli Perfoll — ginecologista longevidade feminina BC',
      quality: quality || 'high',
      gender: gender || 'female',
      images: images
    });

    console.log('Enviando para Freepik — imagens:', images.slice(0,2));
    console.log('Nome:', name, 'Qualidade:', quality, 'Genero:', gender);

    const options = {
      hostname: 'api.freepik.com',
      path: '/v1/ai/loras/characters',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-freepik-api-key': fp_key
      }
    };

    const fpResp = await new Promise((resolve, reject) => {
      const reqFp = https.request(options, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      reqFp.on('error', reject);
      reqFp.write(payload);
      reqFp.end();
    });

    console.log('Freepik LoRA status:', fpResp.status);
    console.log('Freepik LoRA body:', fpResp.body);

    let parsed;
    try { parsed = JSON.parse(fpResp.body); } catch(e) { parsed = { raw: fpResp.body }; }

    if (fpResp.status >= 400) {
      return res.status(fpResp.status).json({
        error: parsed?.message || parsed?.detail || fpResp.body,
        freepik_response: parsed
      });
    }

    res.json(parsed);
  } catch (err) {
    console.error('Erro register-character:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/check-lora-status
   Proxy para Freepik GET /loras — verifica status do treino
   ───────────────────────────────────────────────────────── */
app.get('/api/check-lora-status', async (req, res) => {
  try {
    const fp_key = req.query.fp_key;
    const task_id = req.query.task_id;
    if (!fp_key) return res.status(400).json({ error: 'Chave Freepik nao fornecida.' });

    /* Se task_id fornecido, consulta status via mystic; senão lista LoRAs registrados */
    const path = task_id
      ? '/v1/ai/mystic/' + task_id
      : '/v1/ai/loras/characters';

    const options = {
      hostname: 'api.freepik.com',
      path: path,
      method: 'GET',
      headers: { 'x-freepik-api-key': fp_key }
    };

    const fpResp = await new Promise((resolve, reject) => {
      const reqFp = https.request(options, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      reqFp.on('error', reject);
      reqFp.end();
    });

    let parsed;
    try { parsed = JSON.parse(fpResp.body); } catch(e) { parsed = { raw: fpResp.body }; }

    console.log('check-lora-status path:', path, 'HTTP status:', fpResp.status);
    console.log('check-lora-status raw body:', fpResp.body.substring(0, 600));
    console.log('check-lora-status data:', (JSON.stringify(parsed?.data) || '(vazio)').substring(0, 400));
    res.json(parsed);
  } catch (err) {
    console.error('Erro check-lora-status:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────
   DELETE /api/upload-photos/:session_id
   Limpeza manual das fotos temporarias
   ───────────────────────────────────────────────────────── */
app.delete('/api/upload-photos/:session_id', (req, res) => {
  try {
    const sessionDir = path.join(UPLOADS_DIR, req.params.session_id);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('DataScout rodando na porta ' + PORT);
});
