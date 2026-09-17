# Integrações da InfoCore

O projeto não contém credenciais. Copie `.env.example` para `.env`, preencha somente no servidor e reinicie a aplicação. Nunca publique `.env` nem injete tokens do Google, Meta ou do formulário no HTML.

## Consentimento

O banner trabalha com três categorias: necessários, analytics e marketing. A escolha fica no `localStorage` sob `infocore_consent_v1`. O Consent Mode começa com todos os armazenamentos opcionais negados. GA4/GTM e Clarity carregam após consentimento de analytics; Meta Pixel carrega após consentimento de marketing.

Para testar novamente, use “Preferências de cookies” no rodapé ou apague essa chave no armazenamento do navegador.

## Google Tag Manager e GA4

1. Crie um contêiner Web no Google Tag Manager e informe `GTM_ID=GTM-XXXXXXX`.
2. No GTM, crie uma tag de configuração do GA4 e use o ID do fluxo Web.
3. Crie um gatilho de Evento Personalizado para os eventos descritos na tabela abaixo.
4. Crie variáveis da camada de dados para os parâmetros necessários.
5. Valide com o Preview/Tag Assistant e publique o contêiner.

Se não usar GTM, informe `GA4_ID=G-XXXXXXXXXX`. O código carrega GA4 diretamente e envia os mesmos eventos. Se `GTM_ID` estiver preenchido, o carregamento direto de GA4 é ignorado para evitar page views e eventos duplicados. No GTM, não habilite page view automático junto com uma tag que escute o evento `page_view` deste site sem ajustar o gatilho.

## Microsoft Clarity

Crie o projeto no Clarity e informe `CLARITY_ID`. O script só é inserido após consentimento de analytics. Use o painel oficial para heatmaps, gravações, rage clicks e profundidade de rolagem.

## Meta Pixel

Crie ou selecione um Pixel no Gerenciador de Eventos e informe `META_PIXEL_ID`. O script só carrega após consentimento de marketing. `PageView` é enviado uma vez; cliques de WhatsApp são mapeados para `Contact`; sucesso real do formulário é mapeado para `Lead`. Para Conversion API, use posteriormente um endpoint server-side com deduplicação por `event_id`; não envie dados pessoais sem base legal e tratamento apropriado.

## Avaliações do Google

A configuração padrão é `GOOGLE_REVIEWS_PROVIDER=embed`. Ela não precisa de chave, projeto no Google Cloud, OAuth ou cartão. O mapa oficial continua incorporado e um sincronizador de melhor esforço abre o painel público de avaliações em um Chromium leve, percorre a lista e grava o resultado em `.cache/google-reviews.json`.

A instalação inclui uma cópia inicial das 19 avaliações públicas coletadas em `data/google-reviews-bootstrap.json`, para não voltar às três avaliações antigas enquanto a primeira sincronização roda. A cópia persistida mais recente tem preferência, e novas avaliações entram pela coleta automática.

O `postinstall` instala automaticamente o Chromium em `.cache/ms-playwright` ao executar `npm install`/`npm ci`. Se scripts de instalação estiverem desativados, execute `npm run google:setup`. Para usar uma instalação externa, informe `PLAYWRIGHT_BROWSERS_PATH`. `npm run google:sync` força uma coleta e informa quantas avaliações foram recuperadas.

A sincronização ocorre 15 segundos após a inicialização e depois a cada 5 minutos (ajustável em `GOOGLE_REVIEWS_REFRESH_MS`, mínimo de 60 segundos). Visitantes nunca esperam o Maps: a página e `/api/reviews` leem apenas a última cópia válida. Falhas ou coletas incompletas são tentadas novamente após um minuto. O navegador consulta novas avaliações a cada 30 segundos enquanto a página está visível e ao retornar à aba. Assim, uma nova avaliação pública entra automaticamente após a próxima coleta bem-sucedida, sem recarregar a página. Uma resposta incompleta ou um bloqueio temporário do Google não apaga o conjunto já coletado. `GOOGLE_REVIEWS_PUBLIC_SYNC=0` desativa novas coletas sem apagar o cache. Como esse acesso usa a interface pública não documentada do Maps, ele é necessariamente de melhor esforço; a opção oficial e estável continua sendo a Business Profile API abaixo.

Os botões externos podem ser ajustados com `GOOGLE_REVIEWS_URL` e `GOOGLE_REVIEW_WRITE_URL`; se ficarem vazios, o primeiro usa a busca pública definida em `config/business.js`.

### Opção avançada: Business Profile API

Caso o projeto obtenha aprovação no futuro, a **Google Business Profile API** pode fornecer os textos das avaliações sem a cobrança por chamada da Places API. Ela só acessa um perfil autorizado pelo proprietário e exige aprovação prévia do projeto pelo Google:

1. Solicite acesso às Business Profile APIs para o projeto da empresa. O Google informa que a análise pode levar até 14 dias.
2. Após a aprovação, ative `Google My Business API`, `My Business Account Management API` e `My Business Business Information API`.
3. Crie um cliente OAuth 2.0 do tipo Web e autorize a conta proprietária com o escopo `https://www.googleapis.com/auth/business.manage`.
4. Informe `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e `GOOGLE_OAUTH_REFRESH_TOKEN` somente no servidor.
5. Altere para `GOOGLE_REVIEWS_PROVIDER=business_profile`.
6. Informe `GOOGLE_REVIEWS_URL` e `GOOGLE_REVIEW_WRITE_URL` para os botões públicos.

Depois de cadastrar `http://127.0.0.1:3136/oauth2callback` como URI autorizada no cliente OAuth e preencher o client ID/secret, execute `npm run google:connect`. O utilitário abre um callback local, fornece o endereço de autorização e, ao final, mostra o refresh token e os locais disponíveis no próprio terminal.

O backend descobre automaticamente a conta e a localização quando existe apenas uma opção ou quando `GOOGLE_PLACE_ID` corresponde ao local gerenciado. Se houver mais de uma conta ou local e não for possível resolver sem ambiguidade, preencha também `GOOGLE_BUSINESS_ACCOUNT_ID` e `GOOGLE_BUSINESS_LOCATION_ID`.

Nesse modo avançado, o navegador chama `/api/reviews`; o servidor renova o access token, percorre todas as páginas de avaliações (50 por requisição) com `orderBy=updateTime desc`, reduz o payload e mantém cache em memória por 6 horas. O modo antigo da Places API continua disponível somente se `GOOGLE_REVIEWS_PROVIDER=places` for definido explicitamente.

## Instagram Graph API

1. Converta o perfil em uma conta profissional elegível.
2. Configure um app Meta com as permissões aplicáveis à leitura da mídia da própria conta, usando Instagram Login ou Facebook Login.
3. Informe o token de longa duração em `INSTAGRAM_ACCESS_TOKEN`. Para Facebook Login, informe também `INSTAGRAM_USER_ID`; no fluxo Instagram Login, o backend usa `me` automaticamente.
4. Informe em `META_GRAPH_API_VERSION` a versão habilitada no app Meta (o exemplo usa `v22.0`).
5. Planeje a renovação segura do token no servidor.

O endpoint `/api/instagram` detecta tokens do Instagram Login (`IG...`) e usa `graph.instagram.com`; tokens do Facebook Login (`EAA...`) usam `graph.facebook.com`. A integração aplica timeout, cache em memória de 1 hora e retorna apenas seis itens. O token nunca aparece no HTML. Sem credenciais, a seção exibe um asset real da marca e link para o perfil, sem imitar um feed.

## Catálogo de produtos

A página `/catalogo` lê a coleção `products` do mesmo Firestore usado pelo sistema interno. A API pública `/api/catalog/products` inclui somente produtos ativos e exclui registros com `itemType=service`. Ela envia nome, descrição, categoria, preço, imagem e estado de disponibilidade; custo, SKU, estoque mínimo e demais campos administrativos nunca são expostos.

O servidor mantém uma cópia persistente em `.cache/products.json` e uma escuta em tempo real da coleção. Alterações de preço, estoque, nome ou status entram no catálogo automaticamente, sem aguardar uma visita. O cache faz a página abrir imediatamente e preserva a última versão válida durante lentidão ou indisponibilidade temporária do Firebase. `PRODUCT_CATALOG_SYNC=0` interrompe novas sincronizações sem apagar o cache.

Imagens HTTPS cadastradas no produto são usadas diretamente. Caminhos locais de `uploads` passam pela rota restrita `/catalog-media`; por padrão ela lê `../InfoCore-System/uploads`, ou o diretório definido em `PRODUCT_MEDIA_DIR`. Produtos sem foto recebem uma ilustração visual por categoria, sem usar imagens falsas.

## Formulário

O frontend envia para `/api/contact`. O endpoint valida tamanho, rejeita honeypot, impede envios rápidos demais, limita a cinco tentativas por IP a cada 15 minutos e encaminha JSON para `CONTACT_WEBHOOK_URL`. O token Bearer opcional fica em `CONTACT_WEBHOOK_TOKEN`.

Conecte um endpoint controlado pela empresa (função serverless, automação autenticada ou provedor transacional) que aceite:

```json
{ "name": "...", "email": "...", "phone": "...", "message": "...", "source": "infocore-site" }
```

Sem webhook, o formulário informa claramente que ainda não está conectado e orienta o WhatsApp. O site não finge sucesso. Recomenda-se adicionar CAPTCHA adaptativo no backend se houver abuso real.

## Eventos

| Evento | Disparo | Parâmetros principais | Destino |
|---|---|---|---|
| `page_view` | Primeira carga após consentimento | page_path, page_title, campanha, dispositivo | GA4/GTM; PageView no Meta |
| `hero_cta_click` | CTA “Ver serviços” | section, cta_label | GA4/GTM |
| `whatsapp_click` | Qualquer abertura de WhatsApp | section, service, cta_label, atribuição | GA4/GTM; Contact no Meta |
| `service_view` | Seção de serviços visível | section | GA4/GTM |
| `service_click` | Interação no card | section, service, interaction | GA4/GTM |
| `service_whatsapp_click` | CTA de serviço | section, service, cta_label | GA4/GTM |
| `navigation_click` | Menu principal | destination, cta_label | GA4/GTM |
| `phone_click` / `email_click` | Links de contato | section, cta_label | GA4/GTM |
| `instagram_click` | Link para Instagram | section | GA4/GTM |
| `google_reviews_click` | Link para o Google | section | GA4/GTM |
| `maps_click` | Endereço/rota | section | GA4/GTM |
| `contact_form_start` | Primeira interação no formulário | section | GA4/GTM |
| `contact_form_submit` | Tentativa de envio válida | section | GA4/GTM |
| `contact_form_success` | Backend confirmou entrega | section | GA4/GTM; Lead no Meta |
| `contact_form_error` | Validação ou falha | section, error_type | GA4/GTM |
| `portfolio_view` | Seção visual visível | section | GA4/GTM |
| `portfolio_interaction` | Reservado para interação ampliada da galeria | item, action | GA4/GTM |
| `product_view` | Seção/card de produto visto | section, product | GA4/GTM |
| `product_interest` | CTA de produto | section, service, cta_label | GA4/GTM |
| `faq_open` | FAQ aberto | faq_index, faq_question | GA4/GTM |
| `scroll_depth` | 25%, 50%, 75%, 90%, 100% uma vez | percent_scrolled | GA4/GTM |
| `engagement_time` | 30, 60 e 120 s ativos | seconds | GA4/GTM |
| `outbound_click` | Link para outro domínio | destination_host, section | GA4/GTM |
| `cta_view` / `cta_click` | CTA final visto/clicado | section, cta_label | GA4/GTM |
| `diagnostic_start` | Abertura do check-up guiado | detected_device | GA4/GTM |
| `diagnostic_complete` | Resultado recebido do PowerShell | source, has_ssd, memory_band | GA4/GTM |
| `diagnostic_script_download` | Download do script transparente | platform | GA4/GTM |

Todos recebem também `page_path`, `device_type`, UTMs, `gclid`, `fbclid`, primeira landing page e primeiro referrer da sessão. Nenhum campo digitado no formulário é enviado à camada de analytics.

## PostHog

Não foi instalado. GA4/GTM + Clarity + Meta já cobrem aquisição, funil, mapas de calor e sessões para esta landing page. PostHog só deve ser reconsiderado se houver uma jornada de produto autenticada, experimentos ou coortes que justifiquem outro script e outra governança de consentimento.

## Checklist de publicação

- Confirmar razão social/responsável pela privacidade e revisar os textos legais.
- Confirmar horário de atendimento; ele foi omitido porque havia três versões divergentes no site antigo.
- Confirmar links diretos do Perfil da Empresa no Google.
- Testar consentimento aceito, recusado e personalizado no Tag Assistant, Clarity e Meta Pixel Helper.
- Enviar um formulário real e confirmar o recebimento antes de divulgar esse canal.
