require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Import routes
const contentRoutes = require('./routes/content');
const analyzeRoutes = require('./routes/analyze');
const scrapeRoutes = require('./routes/scrape');
const socialRoutes = require('./routes/social');

// Register routes
app.use('/api/content', contentRoutes);
app.use('/api/social', socialRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', scrapeRoutes);

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`DataScout rodando na porta ${PORT}`);
  console.log(`Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'ok' : 'AUSENTE'}`);
  console.log(`Apify:     ${process.env.APIFY_API_KEY ? 'ok' : 'nao configurado'}`);
});
