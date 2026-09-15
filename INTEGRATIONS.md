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

A implementação usa a **Places API (New)** oficial, adequada para exibir informações públicas de um local sem scraping:

1. No Google Cloud, ative Places API (New) e faturamento.
2. Restrinja uma API key ao serviço Places API e, quando possível, ao IP do servidor.
3. Encontre o Place ID oficial da InfoCore e informe `GOOGLE_PLACE_ID`.
4. Informe a chave em `GOOGLE_PLACES_API_KEY` somente no servidor.
5. Informe os links públicos em `GOOGLE_REVIEWS_URL` e `GOOGLE_REVIEW_WRITE_URL`.

O navegador chama `/api/reviews`; o servidor aplica timeout de 6 segundos, reduz o payload, armazena resultado em memória por 6 horas e oferece cache HTTP. Sem configuração ou em falha, a página mantém um fallback honesto e não mostra nota ou depoimento inventado.

A Google Business Profile API é indicada quando a empresa precisa gerenciar dados e avaliações da própria conta, mas exige projeto aprovado e OAuth do proprietário. Ela pode substituir o carregador interno no futuro sem alterar o frontend. Não coloque client secret ou refresh token no navegador.

## Instagram Graph API

1. Converta/conecte o perfil a uma conta profissional elegível e a uma Página do Facebook.
2. Configure um app Meta com as permissões aplicáveis à leitura da mídia da própria conta.
3. Obtenha `INSTAGRAM_USER_ID` e um token de longa duração em `INSTAGRAM_ACCESS_TOKEN`.
4. Planeje a renovação segura do token no servidor.

O endpoint `/api/instagram` usa a Graph API, timeout, cache em memória de 1 hora e retorna apenas seis itens. O token nunca aparece no HTML. Sem credenciais, a seção exibe um asset real da marca e link para o perfil, sem imitar um feed.

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
