'use strict';

require('dotenv').config({ quiet: true });
const http = require('http');
const crypto = require('crypto');

const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
const redirectUri = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:3136/oauth2callback').trim();

if (!clientId || !clientSecret) {
  process.stderr.write('Preencha GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no .env antes de continuar.\n');
  process.exit(1);
}

const redirect = new URL(redirectUri);
if (redirect.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(redirect.hostname)) {
  process.stderr.write('Use uma GOOGLE_OAUTH_REDIRECT_URI local, por exemplo http://127.0.0.1:3136/oauth2callback.\n');
  process.exit(1);
}

const state = crypto.randomBytes(24).toString('hex');
const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authorizationUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/business.manage',
  access_type: 'offline',
  prompt: 'consent',
  state,
}).toString();

async function googleJson(url, accessToken) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, 'X-GOOG-API-FORMAT-VERSION': '2' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Google respondeu HTTP ${response.status}`);
  return payload;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, redirectUri);
  if (requestUrl.pathname !== redirect.pathname) return res.writeHead(404).end('Não encontrado');
  if (requestUrl.searchParams.get('state') !== state) return res.writeHead(400).end('Estado OAuth inválido. Reinicie o processo.');
  const code = requestUrl.searchParams.get('code');
  if (!code) return res.writeHead(400).end(`Autorização não concluída: ${requestUrl.searchParams.get('error') || 'código ausente'}`);
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) throw new Error(tokens.error_description || 'O Google não retornou refresh token. Revogue o acesso anterior e tente novamente.');
    const accountsPayload = await googleJson('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', tokens.access_token);
    const choices = [];
    for (const account of accountsPayload.accounts || []) {
      const accountId = String(account.name || '').replace(/^accounts\//, '');
      const locations = await googleJson(`https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${encodeURIComponent(accountId)}/locations?readMask=name,title,metadata&pageSize=100`, tokens.access_token);
      for (const location of locations.locations || []) choices.push({ accountId, locationId: String(location.name || '').replace(/^locations\//, ''), title: location.title || '', placeId: location.metadata?.placeId || '' });
    }
    process.stdout.write('\nConexão concluída. Guarde estes valores somente no .env:\n');
    process.stdout.write(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    process.stdout.write('\nContas e locais disponíveis:\n');
    process.stdout.write(`${JSON.stringify(choices, null, 2)}\n`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>InfoCore conectada ao Google</h1><p>Volte ao terminal para concluir a configuração.</p>');
  } catch (error) {
    process.stderr.write(`Falha na conexão: ${error.message}\n`);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não foi possível conectar. Consulte o terminal.');
  } finally {
    setTimeout(() => server.close(), 500);
  }
});

server.listen(Number(redirect.port || 80), redirect.hostname, () => {
  process.stdout.write('Cadastre esta URI no cliente OAuth do Google:\n');
  process.stdout.write(`${redirectUri}\n\nAbra este endereço no navegador e autorize a conta proprietária:\n`);
  process.stdout.write(`${authorizationUrl}\n`);
});
