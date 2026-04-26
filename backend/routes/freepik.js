/**
 * DataScout — Rotas Freepik
 * Proxy server-side para a API do Freepik (evita CORS e protege a chave)
 *
 * Rotas:
 *   POST /api/freepik/upload-photos/:sessionId  — upload de fotos para treino LoRA
 *   DELETE /api/freepik/upload-photos/:sessionId — limpa sessão de upload
 *   POST /api/freepik/register-lora             — registra personagem (treina LoRA)
 *   GET  /api/freepik/check-status              — verifica status de treino ou geração
 *   POST /api/freepik/generate-image            — gera imagem com Freepik Mystic
 */

const express = require('express');
const axios   = require('axios');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

// Armazenamento temporário de fotos em memória (por sessionId)
const uploadSessions = {};

// ─── helpers ──────────────────────────────────────────────────────────────────

function freepikHeaders(fpKey) {
  return {
    'X-Freepik-API-Key': fpKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function getFpKey(req) {
  // Usa sempre a chave do servidor (.env). Nunca expõe no frontend.
  return process.env.FREEPIK_API_KEY || req.body?.fp_key || req.query?.fp_key || '';
}

// ─── POST /api/freepik/upload-photos ─────────────────────────────────────────
// Versão sem sessionId na URL (compatível com Neritas: session_id vem no body)
router.post('/upload-photos', express.json({ limit: '50mb' }), (req, res) => {
  const { photos, session_id } = req.body;
  const sessionId = session_id || ('session-' + Date.now());

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'Envie um array "photos" com as imagens em base64.' });
  }
  if (photos.length < 8) {
    return res.status(400).json({ error: `Mínimo de 8 fotos necessário. Enviadas: ${photos.length}` });
  }
  if (photos.length > 20) {
    return res.status(400).json({ error: `Máximo de 20 fotos. Enviadas: ${photos.length}` });
  }

  uploadSessions[sessionId] = { photos, createdAt: Date.now() };

  // O Freepik LoRA exige URLs públicas — base64 não é aceito diretamente.
  // Para treinar o personagem é necessário hospedar as fotos em um CDN (ex: Cloudinary, S3).
  // Retornamos session_id para que a sessão seja usada em /register-lora,
  // e urls vazio para que o frontend saiba que precisa de um CDN externo.
  return res.json({
    ok: true,
    session_id: sessionId,
    count: photos.length,
    urls: [],
    warning: 'Fotos armazenadas em memória. O treino LoRA requer URLs públicas — configure um CDN (Cloudinary/S3) para habilitar o treinamento de personagem.',
  });
});

// ─── POST /api/freepik/upload-photos/:sessionId ───────────────────────────────
// Recebe fotos em base64 e guarda em memória para uso posterior no register-lora
router.post('/upload-photos/:sessionId', express.json({ limit: '50mb' }), (req, res) => {
  const { sessionId } = req.params;
  const { photos } = req.body; // array de { name, base64, mimeType }

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'Envie um array "photos" com as imagens em base64.' });
  }
  if (photos.length < 8) {
    return res.status(400).json({ error: `Mínimo de 8 fotos necessário. Enviadas: ${photos.length}` });
  }
  if (photos.length > 20) {
    return res.status(400).json({ error: `Máximo de 20 fotos. Enviadas: ${photos.length}` });
  }

  uploadSessions[sessionId] = {
    photos,
    createdAt: Date.now(),
  };

  res.json({ ok: true, sessionId, count: photos.length });
});

// ─── DELETE /api/freepik/upload-photos/:sessionId ────────────────────────────
router.delete('/upload-photos/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  delete uploadSessions[sessionId];
  res.json({ ok: true });
});

// ─── POST /api/freepik/register-lora ─────────────────────────────────────────
// Registra as fotos no Freepik e inicia treinamento do personagem
router.post('/register-lora', express.json({ limit: '50mb' }), async (req, res) => {
  const fpKey = getFpKey(req);
  if (!fpKey) return res.status(400).json({ error: 'Chave Freepik não fornecida.' });

  const { sessionId, name, description, gender, quality } = req.body;

  let photos = req.body.photos; // fotos enviadas diretamente

  // Se tiver sessionId, usar fotos da sessão
  if (sessionId && uploadSessions[sessionId]) {
    photos = uploadSessions[sessionId].photos;
  }

  if (!photos || !Array.isArray(photos) || photos.length < 8) {
    return res.status(400).json({ error: 'Fotos não encontradas. Faça o upload primeiro.' });
  }

  // Extrair URLs ou base64 das fotos
  // Freepik LoRA aceita URLs públicas — para base64 precisaríamos de um CDN intermediário.
  // Por ora, enviamos as URLs se disponíveis, ou retornamos orientação.
  const imageUrls = photos
    .map(p => p.url || null)
    .filter(Boolean);

  if (imageUrls.length < 8) {
    return res.status(400).json({
      error: 'O Freepik LoRA requer URLs públicas das imagens. Faça upload para um serviço externo (ex: Cloudinary, S3) e tente novamente.',
      hint: 'As fotos precisam ser acessíveis publicamente pelo Freepik.'
    });
  }

  try {
    const response = await axios.post(
      'https://api.freepik.com/v1/ai/loras',
      {
        name: name || 'roseli-perfoll-v3',
        description: description || 'Dra. Roseli Perfoll — ginecologista longevidade feminina BC',
        quality: quality || 'high',
        gender: gender || 'female',
        images: imageUrls,
      },
      { headers: freepikHeaders(fpKey), timeout: 30000 }
    );

    const taskId = response.data?.data?.task_id || null;
    res.json({ ok: true, task_id: taskId, data: response.data });
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    res.status(status).json({ error: 'Freepik LoRA: ' + msg });
  }
});

// ─── GET /api/freepik/check-status ───────────────────────────────────────────
// Verifica status de um treino LoRA ou de uma geração de imagem (Mystic)
router.get('/check-status', async (req, res) => {
  const fpKey = getFpKey(req);
  if (!fpKey) return res.status(400).json({ error: 'Chave Freepik não fornecida.' });

  const { task_id, type } = req.query;
  // type = 'lora' (padrão) | 'image'

  try {
    let url;
    if (task_id && type === 'image') {
      // Status de geração de imagem (Mystic)
      url = `https://api.freepik.com/v1/ai/mystic/${task_id}`;
    } else if (task_id) {
      // Status de treino LoRA por task_id específico
      url = `https://api.freepik.com/v1/ai/loras/${task_id}`;
    } else {
      // Listar todos os LoRAs do usuário
      url = 'https://api.freepik.com/v1/ai/loras';
    }

    const response = await axios.get(url, {
      headers: freepikHeaders(fpKey),
      timeout: 15000,
    });

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    res.status(status).json({ error: 'Freepik check-status: ' + msg });
  }
});

// Alias para compatibilidade com o código do Neritas (/api/check-lora-status)
router.get('/check-lora-status', async (req, res) => {
  // redirecionar internamente para check-status
  req.query.type = req.query.task_id ? 'image' : 'lora';
  // re-use same logic
  const fpKey = getFpKey(req);
  if (!fpKey) return res.status(400).json({ error: 'Chave Freepik não fornecida.' });

  const { task_id } = req.query;

  try {
    let url;
    if (task_id) {
      // Tenta como Mystic primeiro, se falhar tenta LoRA
      try {
        const r = await axios.get(`https://api.freepik.com/v1/ai/mystic/${task_id}`, {
          headers: freepikHeaders(fpKey), timeout: 10000,
        });
        return res.json(r.data);
      } catch (_) {
        const r = await axios.get(`https://api.freepik.com/v1/ai/loras/${task_id}`, {
          headers: freepikHeaders(fpKey), timeout: 10000,
        });
        return res.json(r.data);
      }
    } else {
      const r = await axios.get('https://api.freepik.com/v1/ai/loras', {
        headers: freepikHeaders(fpKey), timeout: 10000,
      });
      return res.json(r.data);
    }
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.message;
    res.status(status).json({ error: msg });
  }
});


// ─── POST /api/freepik/generate-image ──────────────────────────────────────────────
// Gera imagem via Freepik Mystic (assíncrono — retorna task_id)
router.post('/generate-image', express.json({ limit: '10mb' }), async (req, res) => {
  const fpKey = getFpKey(req);
  if (!fpKey) return res.status(400).json({ error: 'Chave Freepik não fornecida.' });

  const {
    prompt,
    aspect_ratio = 'social_post_4_5',
    model,
    resolution,
    styling,
    filter_nsfw = true,
  } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Campo obrigatório: prompt.' });

  const body = {
    prompt,
    aspect_ratio,
    filter_nsfw,
  };

  if (model) body.model = model;
  if (resolution) body.resolution = resolution;
  if (styling) body.styling = styling;

  try {
    const response = await axios.post(
      'https://api.freepik.com/v1/ai/mystic',
      body,
      { headers: freepikHeaders(fpKey), timeout: 30000 }
    );

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.response?.data?.detail || err.message;
    res.status(status).json({ error: 'Freepik Mystic: ' + msg });
  }
});

// Limpar sessões antigas a cada 30 minutos
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  Object.keys(uploadSessions).forEach(id => {
    if (uploadSessions[id].createdAt < cutoff) {
      delete uploadSessions[id];
    }
  });
}, 30 * 60 * 1000);

module.exports = router;
