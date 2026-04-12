const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
