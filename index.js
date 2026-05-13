require('dotenv').config();

//TODO-------------importes------------
const express = require('express')
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session')
const path = require('path');
const multer = require('multer')
const cookieParser = require("cookie-parser");
const { MercadoPagoConfig, Payment, Point } = require('mercadopago');
// const config = require('./config/config.json');

//TODO------------Configs--------------

const app = express();

if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

function siteOrigin(req) {
    const fromEnv = process.env.SITE_URL && String(process.env.SITE_URL).trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    return `${req.protocol}://${req.get('host')}`;
}

app.use(session({
    secret: process.env.SECRET || 'infocore-fajg3bi2bt3fi3nt2fajbf2',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 3600000
    }
}));
app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

app.use(express.static('views'));
app.use(express.static('public'));
app.use(express.static('uploads'));
app.use(express.static('src'));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'src')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs');


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname + '/uploads/')
    },
    filename: function (req, file, cb) {
        const codigo = require('crypto').randomBytes(42).toString('hex');
        const originalName = file.originalname;
        const extension = originalName.substr(originalName.lastIndexOf('.'));
        const fileName = codigo + extension;
        cb(null, `${fileName}`)
    }
});

const upload = multer({ storage });





//TODO------------WEB PAGE--------------

app.get('/robots.txt', (req, res) => {
    const origin = siteOrigin(req);
    res.type('text/plain');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
    const origin = siteOrigin(req);
    const lastmod = new Date().toISOString().split('T')[0];
    res.type('application/xml');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>${origin}/</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>1.0</priority>\n` +
        `  </url>\n` +
        `</urlset>\n`
    );
});

app.get('/', (req, res) => {
    const origin = siteOrigin(req);
    const pageTitle = 'InfoCore — Informática, manutenção e vendas | Simão Dias/SE';
    const pageDescription =
        'Manutenção de computadores e notebooks, montagem de PCs, recuperação de dados, remoção de vírus, upgrades, vendas de equipamentos e atendimento em Simão Dias, Sergipe. Fale pelo WhatsApp.';
    const ogImageUrl =
        (process.env.OG_IMAGE_URL && String(process.env.OG_IMAGE_URL).trim()) ||
        `${origin}/public/img/banner_infos.png`;
    res.render('index', {
        siteUrl: origin,
        canonicalUrl: `${origin}/`,
        ogImageUrl,
        pageTitle,
        pageDescription,
    });
});


app.listen(3131, () => {
    const dataHora = new Date();
    const formatado = d => ('0' + d).slice(-2);
    const dataHoraFormatada = `${formatado(dataHora.getDate())}/${formatado(dataHora.getMonth() + 1)}/${dataHora.getFullYear()} ${formatado(dataHora.getHours())}:${formatado(dataHora.getMinutes())}:${formatado(dataHora.getSeconds())}`;
    console.log(`${dataHoraFormatada} [WEB] Servidor rodando na porta 3131`);
});

