const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { ApifyClient } = require('apify-client');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// =============================================
// ROTAS DA API (FeedMax)
// =============================================
const socialRoutes  = require('./routes/social');
const contentRoutes = require('./routes/content');
const clientRoutes  = require('./routes/client');
const freepikRoutes = require('./routes/freepik');

app.use('/api/social',  socialRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/client',  clientRoutes);
app.use('/api/freepik', freepikRoutes);

// Inicializar Apify Client
const apifyClient = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

console.log('🔑 Apify:', process.env.APIFY_API_TOKEN ? '✅ Configurado' : '❌ Não configurado');

// =============================================
// FUNÇÕES DE PESQUISA REAL
// =============================================

async function searchInstagram(tema) {
    try {
        console.log(`   📸 Instagram: buscando "${tema}"...`);
        const run = await apifyClient.actor('apify/instagram-scraper').call({
            searchQueries: [tema],
            resultsLimit: 5,
            searchType: 'top'
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        console.log(`   ✅ Instagram: ${items.length} posts encontrados`);
        return items.slice(0, 5).map(item => ({
            texto: item.caption || item.text || 'Sem legenda',
            curtidas: item.likesCount || 0,
            comentarios: item.commentsCount || 0,
            fonte: 'Instagram',
            url: item.url || '',
            cor: '#E4405F'
        }));
    } catch (error) {
        console.log(`   ❌ Instagram: ${error.message}`);
        return [];
    }
}

async function searchTwitter(tema) {
    try {
        console.log(`   🐦 Twitter: buscando "${tema}"...`);
        const run = await apifyClient.actor('quacker/twitter-scraper').call({
            searchTerms: [tema],
            maxItems: 5,
            tweetLanguage: 'pt'
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        console.log(`   ✅ Twitter: ${items.length} tweets encontrados`);
        return items.slice(0, 5).map(item => ({
            texto: item.full_text || item.text || 'Sem texto',
            curtidas: item.favorite_count || 0,
            comentarios: item.reply_count || 0,
            compartilhamentos: item.retweet_count || 0,
            fonte: 'X (Twitter)',
            url: `https://twitter.com/i/web/status/${item.id}`,
            cor: '#1DA1F2'
        }));
    } catch (error) {
        console.log(`   ❌ Twitter: ${error.message}`);
        return [];
    }
}

async function searchYouTube(tema) {
    try {
        console.log(`   🎥 YouTube: buscando "${tema}"...`);
        const run = await apifyClient.actor('bernardo/youtube-scraper').call({
            searchQuery: tema,
            maxResults: 5,
            sortBy: 'viewCount'
        });
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        console.log(`   ✅ YouTube: ${items.length} vídeos encontrados`);
        return items.slice(0, 5).map(item => ({
            texto: item.title || 'Sem título',
            curtidas: item.viewCount || 0,
            comentarios: item.commentCount || 0,
            fonte: 'YouTube',
            url: `https://youtube.com/watch?v=${item.id}`,
            cor: '#FF0000'
        }));
    } catch (error) {
        console.log(`   ❌ YouTube: ${error.message}`);
        return [];
    }
}

// Funções com dados de exemplo para plataformas sem API ainda
async function searchTikTok(tema) {
    console.log(`   🎵 TikTok: usando dados de exemplo`);
    return [
        { texto: `😱 ${tema.toUpperCase()} - O vídeo que está viralizando! 🔥`, curtidas: 45000, comentarios: 2300, fonte: 'TikTok', cor: '#000' },
        { texto: `POV: Você descobre o segredo do ${tema}`, curtidas: 28700, comentarios: 1450, fonte: 'TikTok', cor: '#000' }
    ];
}

async function searchLinkedIn(tema) {
    console.log(`   💼 LinkedIn: usando dados de exemplo`);
    return [
        { texto: `Como ${tema} está transformando o mercado`, curtidas: 3450, comentarios: 89, fonte: 'LinkedIn', cor: '#0A66C2' },
        { texto: `Carreira: 5 habilidades sobre ${tema}`, curtidas: 2870, comentarios: 67, fonte: 'LinkedIn', cor: '#0A66C2' }
    ];
}

async function searchReddit(tema) {
    console.log(`   🤖 Reddit: usando dados de exemplo`);
    return [
        { texto: `O que você acha sobre ${tema}?`, curtidas: 8900, comentarios: 234, fonte: 'Reddit', cor: '#FF4500' },
        { texto: `Discussão: ${tema} vale a pena?`, curtidas: 6700, comentarios: 456, fonte: 'Reddit', cor: '#FF4500' }
    ];
}

// =============================================
// ROTAS
// =============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/unificado', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index_unificado.html'));
});

app.post('/api/content/search-multi-platform', async (req, res) => {
    const { tema, plataformas } = req.body;
    console.log(`\n🔍 ===== PESQUISA REAL =====`);
    console.log(`📝 Tema: "${tema}"`);
    console.log(`📱 Plataformas: ${plataformas.join(', ')}`);
    console.log(`⏰ Início: ${new Date().toLocaleTimeString()}\n`);
    
    const results = {};
    const allPosts = [];
    
    const promises = [];
    const platList = [];
    
    if (plataformas.includes('Instagram')) {
        promises.push(searchInstagram(tema));
        platList.push('Instagram');
    }
    if (plataformas.includes('X (Twitter)')) {
        promises.push(searchTwitter(tema));
        platList.push('X (Twitter)');
    }
    if (plataformas.includes('YouTube')) {
        promises.push(searchYouTube(tema));
        platList.push('YouTube');
    }
    if (plataformas.includes('TikTok')) {
        promises.push(searchTikTok(tema));
        platList.push('TikTok');
    }
    if (plataformas.includes('LinkedIn')) {
        promises.push(searchLinkedIn(tema));
        platList.push('LinkedIn');
    }
    if (plataformas.includes('Reddit')) {
        promises.push(searchReddit(tema));
        platList.push('Reddit');
    }
    
    const resultados = await Promise.all(promises);
    
    resultados.forEach((result, idx) => {
        if (result && result.length > 0) {
            results[platList[idx]] = result;
            allPosts.push(...result);
        }
    });
    
    allPosts.sort((a, b) => (b.curtidas || 0) - (a.curtidas || 0));
    
    console.log(`\n✅ Total: ${allPosts.length} posts encontrados`);
    console.log(`⏰ Fim: ${new Date().toLocaleTimeString()}\n`);
    
    res.json({
        success: true,
        results,
        topPosts: allPosts,
        totalPosts: allPosts.length,
        totalEngagement: allPosts.reduce((s, p) => s + (p.curtidas || 0), 0)
    });
});

app.post('/api/content/generate-viral-caption', async (req, res) => {
    const { tema, post } = req.body;
    const hashtags = [`#${tema.toLowerCase().replace(/ /g, '')}`, '#viral', '#trending', '#explore', '#fyp'];
    let legenda = `📢 ${tema.toUpperCase()} ESTÁ BOMBANDO! 📢\n\n${post?.texto || tema}\n\n💬 O que você achou? Comenta aqui!\n❤️ Curtiu? Compartilha!\n\n${hashtags.join(' ')}`;
    res.json({ success: true, legenda, hashtags });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'FeedMax', apify: !!process.env.APIFY_API_TOKEN });
});

app.listen(PORT, () => {
    console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
    console.log(`🚀 Sistema Unificado: http://localhost:${PORT}/unificado`);
    console.log(`🔑 Apify: ${process.env.APIFY_API_TOKEN ? '✅ Configurado' : '❌ Não configurado'}\n`);
});