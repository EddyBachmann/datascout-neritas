const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname)));

const contentRoutes = require('./routes/content');
const analyzeRoutes = require('./routes/analyze');
const scrapeRoutes  = require('./routes/scrape');

app.use('/api/content', contentRoutes);
app.use('/api',         analyzeRoutes);
app.use('/api',         scrapeRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('DataScout rodando na porta ' + PORT);
});
