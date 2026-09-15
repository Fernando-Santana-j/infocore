require('dotenv').config();
const express = require('express');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');
const business = require('./config/business');
const serviceShowcase = require('./config/service-showcase');

const app = express();
const port = Number(process.env.PORT || 3131);
const cache = new Map();
const contactAttempts = new Map();
const diagnosticSessions = new Map();
const diagnosticAttempts = new Map();
setInterval(() => { const cutoff = Date.now() - 600000; for (const [token, session] of diagnosticSessions) if (session.createdAt < cutoff) diagnosticSessions.delete(token); }, 300000).unref();
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(compression());
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
  next();
});

const siteOrigin = (req) => String(process.env.SITE_URL || '').trim().replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
const cached = (key, ttlMs, loader) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.createdAt < ttlMs) return Promise.resolve(hit.data);
  return loader().then((data) => { cache.set(key, { createdAt: Date.now(), data }); return data; });
};
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

app.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(`User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const origin = siteOrigin(req);
  res.type('application/xml').set('Cache-Control', 'public, max-age=86400').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url><url><loc>${origin}/privacidade</loc></url><url><loc>${origin}/cookies</loc></url></urlset>`);
});

app.get('/api/reviews', async (_req, res) => {
  if (!process.env.GOOGLE_PLACES_API_KEY || !process.env.GOOGLE_PLACE_ID) return res.status(503).json({ available: false, reason: 'not_configured' });
  try {
    const data = await cached('google-reviews', 21600000, async () => {
      const response = await fetchWithTimeout(`https://places.googleapis.com/v1/places/${encodeURIComponent(process.env.GOOGLE_PLACE_ID)}?languageCode=pt-BR`, { headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'displayName,rating,userRatingCount,reviews,googleMapsUri' } });
      if (!response.ok) throw new Error();
      const place = await response.json();
      return { available: true, rating: place.rating, count: place.userRatingCount, mapsUrl: place.googleMapsUri, reviews: (place.reviews || []).slice(0, 5).map((review) => ({ name: review.authorAttribution?.displayName || 'Cliente', avatar: review.authorAttribution?.photoUri || '', rating: review.rating, text: review.text?.text || '', date: review.relativePublishTimeDescription || '', url: review.googleMapsUri || place.googleMapsUri || '' })) };
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=21600').json(data);
  } catch (_error) { res.status(502).json({ available: false, reason: 'provider_unavailable' }); }
});

app.get('/api/instagram', async (_req, res) => {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_USER_ID) return res.status(503).json({ available: false, reason: 'not_configured' });
  try {
    const data = await cached('instagram-media', 3600000, async () => {
      const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
      const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(process.env.INSTAGRAM_USER_ID)}/media?fields=${fields}&limit=6&access_token=${encodeURIComponent(process.env.INSTAGRAM_ACCESS_TOKEN)}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) throw new Error();
      const payload = await response.json();
      return { available: true, posts: (payload.data || []).map((post) => ({ id: post.id, caption: post.caption || '', mediaType: post.media_type, imageUrl: post.thumbnail_url || post.media_url, permalink: post.permalink, timestamp: post.timestamp })) };
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600').json(data);
  } catch (_error) { res.status(502).json({ available: false, reason: 'provider_unavailable' }); }
});

function cleanHardwareText(value, max = 160) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

app.post('/api/device-diagnostics/session', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (diagnosticAttempts.get(ip) || []).filter((time) => Date.now() - time < 900000);
  if (recent.length >= 10) return res.status(429).json({ code: 'rate_limited' });
  recent.push(Date.now()); diagnosticAttempts.set(ip, recent);
  const token = crypto.randomBytes(24).toString('hex');
  diagnosticSessions.set(token, { createdAt: Date.now(), status: 'waiting' });
  res.set('Cache-Control', 'no-store').json({ token, scriptUrl: `/api/device-diagnostics/${token}/script`, launcherUrl: `/api/device-diagnostics/${token}/launcher`, expiresIn: 600 });
});

app.get('/api/device-diagnostics/:token/script', (req, res) => {
  const session = diagnosticSessions.get(req.params.token);
  if (!session || Date.now() - session.createdAt > 600000) return res.status(404).send('Sessão expirada. Gere um novo diagnóstico no site.');
  const endpoint = `${siteOrigin(req)}/api/device-diagnostics/${req.params.token}`.replace(/'/g, '');
  const script = `$ErrorActionPreference = 'Stop'\r\n` +
    `Write-Host 'InfoCore - coletando somente especificacoes de hardware...' -ForegroundColor Cyan\r\n` +
    `$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1\r\n` +
    `$system = Get-CimInstance Win32_ComputerSystem\r\n` +
    `$os = Get-CimInstance Win32_OperatingSystem\r\n` +
    `$disks = @(Get-CimInstance Win32_DiskDrive | Select-Object -First 8 | ForEach-Object { @{ model = $_.Model; mediaType = $_.MediaType; sizeGb = [Math]::Round($_.Size / 1GB) } })\r\n` +
    `$gpus = @(Get-CimInstance Win32_VideoController | Select-Object -First 4 | ForEach-Object { $_.Name })\r\n` +
    `$temp = $null; try { $zone = Get-CimInstance MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1; if ($zone.CurrentTemperature) { $temp = [Math]::Round(($zone.CurrentTemperature / 10) - 273.15) } } catch {}\r\n` +
    `$payload = @{ deviceType = if ($system.PCSystemType -eq 2) { 'notebook' } else { 'pc' }; model = $system.Model; cpu = $cpu.Name; cores = $cpu.NumberOfCores; logicalProcessors = $cpu.NumberOfLogicalProcessors; ramGb = [Math]::Round($system.TotalPhysicalMemory / 1GB); temperatureC = $temp; os = $os.Caption; disks = $disks; gpus = $gpus } | ConvertTo-Json -Depth 4\r\n` +
    `Invoke-RestMethod -Uri '${endpoint}' -Method Post -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload)) | Out-Null\r\n` +
    `Write-Host 'Diagnostico enviado. Volte ao navegador.' -ForegroundColor Green\r\n`;
  res.type('text/plain; charset=utf-8').set({ 'Content-Disposition': 'attachment; filename="infocore-diagnostico.ps1"', 'Cache-Control': 'no-store' }).send(script);
});

app.get('/api/device-diagnostics/:token/launcher', (req, res) => {
  const session = diagnosticSessions.get(req.params.token);
  if (!session || Date.now() - session.createdAt > 600000) return res.status(404).send('Sessão expirada. Gere um novo diagnóstico no site.');
  const scriptUrl = `${siteOrigin(req)}/api/device-diagnostics/${req.params.token}/script`.replace(/'/g, '');
  const launcher = `@echo off\r\necho InfoCore - iniciando diagnostico seguro...\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& { $script = (Invoke-WebRequest -UseBasicParsing -Uri '${scriptUrl}').Content; Invoke-Expression $script }"\r\necho.\r\necho Volte para a pagina da InfoCore para ver o resultado.\r\npause\r\n`;
  res.type('text/plain').set({ 'Content-Disposition': 'attachment; filename="iniciar-diagnostico-infocore.cmd"', 'Cache-Control': 'no-store' }).send(launcher);
});

app.post('/api/device-diagnostics/:token', (req, res) => {
  const session = diagnosticSessions.get(req.params.token);
  if (!session || Date.now() - session.createdAt > 600000) return res.status(404).json({ ok: false, code: 'expired' });
  const disks = Array.isArray(req.body.disks) ? req.body.disks.slice(0, 8).map((disk) => ({ model: cleanHardwareText(disk.model), mediaType: cleanHardwareText(disk.mediaType, 60), sizeGb: Math.max(0, Math.min(100000, Number(disk.sizeGb) || 0)) })) : [];
  const gpus = Array.isArray(req.body.gpus) ? req.body.gpus.slice(0, 4).map((gpu) => cleanHardwareText(gpu)) : [];
  session.status = 'complete';
  session.data = { deviceType: req.body.deviceType === 'notebook' ? 'notebook' : 'pc', model: cleanHardwareText(req.body.model), cpu: cleanHardwareText(req.body.cpu), cores: Math.max(0, Math.min(256, Number(req.body.cores) || 0)), logicalProcessors: Math.max(0, Math.min(512, Number(req.body.logicalProcessors) || 0)), ramGb: Math.max(0, Math.min(4096, Number(req.body.ramGb) || 0)), temperatureC: Math.max(0, Math.min(150, Number(req.body.temperatureC) || 0)), os: cleanHardwareText(req.body.os), disks, gpus };
  res.set('Cache-Control', 'no-store').json({ ok: true });
});

app.get('/api/device-diagnostics/:token', (req, res) => {
  const session = diagnosticSessions.get(req.params.token);
  if (!session || Date.now() - session.createdAt > 600000) { diagnosticSessions.delete(req.params.token); return res.status(404).json({ status: 'expired' }); }
  res.set('Cache-Control', 'no-store').json(session.status === 'complete' ? { status: 'complete', data: session.data } : { status: 'waiting' });
});

app.post('/api/contact', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (contactAttempts.get(ip) || []).filter((time) => Date.now() - time < 900000);
  if (recent.length >= 5) return res.status(429).json({ ok: false, code: 'rate_limited' });
  recent.push(Date.now()); contactAttempts.set(ip, recent);
  const { name = '', email = '', phone = '', message = '', company = '', startedAt = 0 } = req.body || {};
  if (company || Date.now() - Number(startedAt) < 2500) return res.status(400).json({ ok: false, code: 'spam' });
  if (String(name).trim().length < 2 || String(message).trim().length < 10 || String(message).length > 2000) return res.status(422).json({ ok: false, code: 'invalid' });
  if (!process.env.CONTACT_WEBHOOK_URL) return res.status(503).json({ ok: false, code: 'not_configured' });
  try {
    const response = await fetchWithTimeout(process.env.CONTACT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.CONTACT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.CONTACT_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify({ name: String(name).trim(), email: String(email).trim(), phone: String(phone).trim(), message: String(message).trim(), source: 'infocore-site' }) }, 8000);
    if (!response.ok) throw new Error();
    res.json({ ok: true });
  } catch (_error) { res.status(502).json({ ok: false, code: 'delivery_failed' }); }
});

function renderPage(req, res, view, title, description) {
  const siteUrl = siteOrigin(req);
  res.render(view, { business, serviceShowcase, siteUrl, canonicalUrl: `${siteUrl}${req.path === '/' ? '/' : req.path}`, ogImageUrl: `${siteUrl}/public/img/og-share-1200.jpg`, pageTitle: title, pageDescription: description, analytics: { gtmId: process.env.GTM_ID || '', ga4Id: process.env.GA4_ID || '', clarityId: process.env.CLARITY_ID || '', metaPixelId: process.env.META_PIXEL_ID || '' }, integrations: { googleReviews: !!(process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACE_ID), instagram: !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID), contact: !!process.env.CONTACT_WEBHOOK_URL } });
}
app.get('/', (req, res) => renderPage(req, res, 'index', 'Assistência técnica em Simão Dias | InfoCore', 'Manutenção de computadores e notebooks, upgrades, montagem de PCs e soluções em informática em Simão Dias, Sergipe. Solicite atendimento pelo WhatsApp.'));
app.get('/privacidade', (req, res) => renderPage(req, res, 'privacy', 'Política de Privacidade | InfoCore', 'Saiba como a InfoCore trata dados pessoais e informações de navegação.'));
app.get('/cookies', (req, res) => renderPage(req, res, 'cookies', 'Política de Cookies | InfoCore', 'Entenda como a InfoCore utiliza cookies necessários, de análise e de marketing.'));
app.use((_req, res) => res.status(404).send('Página não encontrada'));
const server = app.listen(port, () => process.stdout.write(`[WEB] InfoCore disponível na porta ${port}\n`));
module.exports = { app, server };
