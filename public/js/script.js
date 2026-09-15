(function () {
  'use strict';
  const analytics = window.InfoCoreAnalytics;
  const appConfig = window.__INFOCORE_CONFIG__ || {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = (event, params = {}) => analytics?.trackEvent(event, params);

  const header = document.getElementById('header');
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('nav-menu');
  function closeMenu() { menu?.classList.remove('open'); menuButton?.classList.remove('active'); menuButton?.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
  menuButton?.addEventListener('click', () => { const open = !menu.classList.contains('open'); menu.classList.toggle('open', open); menuButton.classList.toggle('active', open); menuButton.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : ''; });
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { track('navigation_click', { section: 'header', destination: link.getAttribute('href'), cta_label: link.textContent.trim() }); closeMenu(); }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

  let ticking = false;
  function updateScroll() {
    const y = window.scrollY; header?.classList.toggle('scrolled', y > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, y / max) : 0;
    const bar = document.querySelector('.scroll-progress span'); if (bar) bar.style.transform = `scaleX(${progress})`;
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(updateScroll); ticking = true; } }, { passive: true }); updateScroll();

  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px' });
  document.querySelectorAll('.reveal').forEach((element, index) => { if (!reducedMotion) element.style.transitionDelay = `${Math.min(index % 4, 3) * 65}ms`; revealObserver.observe(element); });
  function revealPassedElements() { document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => { if (element.getBoundingClientRect().top < innerHeight * 1.05) { element.classList.add('is-visible'); revealObserver.unobserve(element); } }); }
  addEventListener('scroll', revealPassedElements, { passive: true });

  const seen = new Set();
  const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (!entry.isIntersecting) return; const event = entry.target.dataset.observe; if (event && !seen.has(event + entry.target.id)) { seen.add(event + entry.target.id); track(event, { section: entry.target.id || 'unknown' }); } }), { threshold: 0.08, rootMargin: '0px 0px -12%' });
  document.querySelectorAll('[data-observe]').forEach((element) => sectionObserver.observe(element));

  const navObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { document.querySelectorAll('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === entry.target.id)); } }), { rootMargin: '-25% 0px -65%', threshold: 0 });
  document.querySelectorAll('main section[id]').forEach((section) => navObserver.observe(section));

  const messages = { manutencao: 'manutenção do meu computador', notebook: 'manutenção do meu notebook', upgrade: 'um upgrade de SSD ou memória', montagem: 'montagem de um computador', seguranca: 'limpeza ou segurança do meu equipamento', troca_tela: 'troca de tela do meu notebook', dobradica: 'reparo da dobradiça do meu notebook', limpeza: 'limpeza interna do meu equipamento', diagnostico: 'uma orientação para melhorar meu equipamento', ssd: 'um SSD', memoria_ram: 'memória RAM', pecas_perifericos: 'peças ou periféricos' };
  document.querySelectorAll('.js-whatsapp').forEach((link) => {
    const service = link.dataset.service || '';
    const topic = messages[service] || 'um atendimento';
    link.href = `https://wa.me/${appConfig.business?.whatsappNumber || '5579991343921'}?text=${encodeURIComponent(`Olá! Vim pelo site da InfoCore e gostaria de solicitar ${topic}.`)}`;
    link.target = '_blank'; link.rel = 'noopener';
    link.addEventListener('click', () => {
      const context = { section: link.dataset.section || 'unknown', service: service || null, cta_label: link.dataset.label || 'whatsapp' };
      if (context.section === 'hero') track('hero_cta_click', context);
      if (context.section === 'final_cta') track('cta_click', context);
      if (service) track(link.closest('.product') ? 'product_interest' : 'service_whatsapp_click', context);
      analytics?.trackConversion('whatsapp_click', context);
    });
  });
  document.querySelectorAll('.service-card').forEach((card) => card.addEventListener('click', (event) => { if (!event.target.closest('a')) track('service_click', { section: 'services', service: card.dataset.service, interaction: 'card' }); }));
  document.querySelectorAll('[data-track]').forEach((element) => element.addEventListener('click', () => track(element.dataset.track, { section: element.dataset.section || 'unknown', cta_label: element.textContent.trim().slice(0, 80) })));
  document.querySelectorAll('a[target="_blank"]').forEach((link) => link.addEventListener('click', () => { try { if (new URL(link.href).hostname !== location.hostname) track('outbound_click', { section: link.dataset.section || 'unknown', destination_host: new URL(link.href).hostname }); } catch (_) {} }));
  document.querySelectorAll('.product').forEach((card) => card.addEventListener('mouseenter', () => { const key = `product_${card.dataset.product}`; if (!seen.has(key)) { seen.add(key); track('product_view', { section: 'products', product: card.dataset.product }); } }, { once: true }));
  document.querySelectorAll('.faq-item').forEach((item, index) => item.addEventListener('toggle', () => { if (item.open) track('faq_open', { section: 'faq', faq_index: index + 1, faq_question: item.querySelector('summary').textContent.trim().slice(2) }); }));

  const diagnostic = document.getElementById('diagnostic');
  const diagnosticStage = document.getElementById('device-stage');
  const diagnosticDialog = document.getElementById('diagnostic-dialog');
  const diagnosticCta = document.getElementById('diag-cta');
  function alignDiagnosticConnectors() {
    if (!diagnosticStage) return;
    const layer = diagnosticStage.querySelector('.device-connectors g');
    layer.replaceChildren();
    if (diagnosticStage.classList.contains('is-phone')) return;
    const stageRect = diagnosticStage.getBoundingClientRect();
    const notebook = diagnosticStage.classList.contains('is-notebook');
    const pairs = [['cpu', '.socket', true], ['memory', '.ram-b', true], ['gpu', '.gpu', false], ['storage', '.m2', false]];
    for (const [name, component, fromTop] of pairs) {
      const box = diagnosticStage.querySelector(`.node-${name}`).getBoundingClientRect();
      const target = diagnosticStage.querySelector(notebook ? '.notebook-screen' : component).getBoundingClientRect();
      const left = name === 'cpu' || name === 'gpu';
      const x1 = box.x + box.width / 2 - stageRect.x;
      const y1 = (fromTop ? box.bottom : box.top) - stageRect.y;
      const anchorX = notebook ? (left ? .3 : .7) : name === 'gpu' ? .25 : name === 'storage' ? .9 : .5;
      const x2 = target.x + target.width * anchorX - stageRect.x;
      const y2 = target.y + target.height * (notebook ? (fromTop ? .3 : .7) : .5) - stageRect.y;
      const elbow = fromTop ? y1 + 18 : y1 - (left ? 28 : 16);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.dataset.component = name;
      path.setAttribute('d', `M ${x1} ${y1} L ${x1} ${elbow} L ${x2} ${elbow} L ${x2} ${y2}`);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', 4);
      layer.append(path, dot);
    }
  }
  if (diagnosticStage) new ResizeObserver(alignDiagnosticConnectors).observe(diagnosticStage);
  if (diagnosticCta) new IntersectionObserver(([entry]) => {
    document.body.classList.toggle('diagnostic-actions-visible', entry.isIntersecting);
  }).observe(diagnosticCta);
  const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 820);
  let diagnosticToken = '';
  let diagnosticPollTimer = null;
  let fullDiagnosticReceived = false;
  function setDiagnostic(data, source = 'browser') {
    if (source === 'browser' && fullDiagnosticReceived) return;
    if (source === 'powershell') fullDiagnosticReceived = true;
    const isPhone = data.device === 'mobile';
    const isNotebook = !isPhone && (data.deviceType === 'notebook' || /notebook|laptop/i.test(data.model || ''));
    const complete = source === 'powershell';
    diagnosticStage?.classList.toggle('is-phone', isPhone);
    diagnosticStage?.classList.toggle('is-notebook', isNotebook);
    const memory = Number(data.ramGb || data.memory) || 0;
    const memoryText = memory ? `${memory} GB${complete ? '' : ' · aprox.'}` : 'não disponível';
    const cpuText = data.cpu || (data.cores ? `${data.cores} processadores lógicos` : 'não disponível');
    const temp = Number(data.temperatureC) || 0;
    const gpuText = data.gpus?.[0] || (isPhone ? 'câmera / vídeo móvel' : 'não identificado');
    const disks = Array.isArray(data.disks) ? data.disks : [];
    const hasSsd = disks.some((disk) => /ssd|nvme|solid/i.test(`${disk.model} ${disk.mediaType}`));
    const storageText = complete ? (disks.length ? `${hasSsd ? 'SSD' : 'HD'} · ${disks.reduce((sum, disk) => sum + (Number(disk.sizeGb) || 0), 0)} GB` : 'não identificado') : 'requer PowerShell';
    document.getElementById('diag-cpu').textContent = isPhone ? 'dispositivo móvel' : cpuText;
    document.getElementById('diag-temp').textContent = temp ? `${temp}°C · sensor informado` : 'Sensor não disponível';
    document.getElementById('diag-gpu').textContent = gpuText;
    document.getElementById('diag-model').textContent = isPhone ? 'Celular' : (data.model || (isNotebook ? 'Notebook' : 'PC desktop'));
    document.getElementById('diag-memory').textContent = memoryText;
    document.getElementById('diag-profile').textContent = storageText;
    document.getElementById('diag-state').textContent = complete ? 'DIAGNÓSTICO RECEBIDO' : 'LEITURA BÁSICA';
    const label = document.getElementById('diag-device-label');
    const headline = document.getElementById('diag-headline');
    const description = document.getElementById('diag-description');
    let recommendation = 'Uma avaliação técnica ajuda a identificar o melhor próximo passo.';
    let buttonLabel = 'Vamos melhorar meu PC';
    if (isPhone) {
      label.textContent = 'Você está acessando pelo celular';
      headline.textContent = 'Seu primeiro PC pode começar pelo que importa.';
      description.textContent = 'Conte como pretende usar a máquina e a InfoCore ajuda a pensar em uma configuração equilibrada.';
      recommendation = 'Quero montar meu primeiro PC e preciso de orientação.';
      buttonLabel = 'Montar meu primeiro PC';
    } else if (complete && !hasSsd && disks.length) {
      label.textContent = `${isNotebook ? 'Notebook' : 'PC'}${data.model ? ` · ${data.model}` : ''}`;
      headline.textContent = 'Um SSD pode ser o upgrade mais perceptível.';
      description.textContent = 'A compatibilidade e a condição do equipamento ainda precisam ser verificadas pela assistência.';
      recommendation = `O diagnóstico identificou ${memoryText} de RAM e armazenamento sem SSD. Quero avaliar um upgrade de SSD.`;
    } else if (complete && memory <= 4) {
      label.textContent = 'Memória limitada para o uso atual';
      headline.textContent = 'Mais memória pode devolver fôlego ao sistema.';
      description.textContent = 'A InfoCore pode verificar capacidade máxima, tipo de memória e melhor combinação para sua máquina.';
      recommendation = 'Quero avaliar um upgrade de memória RAM no meu equipamento.';
    } else if (complete) {
      const gpu = data.gpus?.[0] || 'vídeo não identificado';
      label.textContent = `${isNotebook ? 'Notebook' : 'PC'}${data.model ? ` · ${data.model}` : ''}`;
      headline.textContent = `${memoryText} de RAM · ${hasSsd ? 'SSD identificado' : storageText}`;
      description.textContent = `${data.cpu || 'Processador identificado'} · ${gpu}. A InfoCore pode avaliar equilíbrio, temperatura e possibilidades de upgrade.`;
      recommendation = `Meu diagnóstico: ${data.cpu}; ${memoryText} de RAM; ${storageText}; vídeo: ${gpu}. Quero uma orientação de melhoria.`;
      buttonLabel = 'Enviar diagnóstico pelo WhatsApp';
    } else {
      label.textContent = 'Leitura permitida pelo navegador';
      headline.textContent = 'Seu equipamento pode ter espaço para melhorar.';
      description.textContent = 'Para identificar as peças de verdade, use o diagnóstico completo no Windows.';
    }
    if (complete && !isPhone) {
      buttonLabel = 'Enviar diagnóstico pelo WhatsApp';
      recommendation = [`Equipamento: ${data.model || (isNotebook ? 'Notebook' : 'PC')}`, `CPU: ${cpuText}`, `RAM: ${memoryText}`, `GPU: ${(data.gpus || []).join(', ') || 'Não identificada'}`, `Discos: ${disks.map(disk => `${disk.model} (${disk.sizeGb} GB)`).join(', ') || 'Não identificados'}`, `Temperatura: ${temp ? `${temp}°C (sensor informado)` : 'Não disponível'}`, recommendation].join('\n');
    }
    diagnosticCta.childNodes[0].textContent = `${buttonLabel} `;
    diagnosticCta.href = `https://wa.me/${appConfig.business?.whatsappNumber || '5579991343921'}?text=${encodeURIComponent(`Olá! Fiz o check-up no site da InfoCore. ${recommendation}`)}`;
    diagnosticCta.dataset.label = isPhone ? 'montar_primeiro_pc' : 'melhorar_pc';
    diagnostic?.classList.add('scan-complete');
    alignDiagnosticConnectors();
  }
  setTimeout(() => setDiagnostic({ device: isMobileDevice ? 'mobile' : 'desktop', memory: navigator.deviceMemory || 0, cores: navigator.hardwareConcurrency || null }), reducedMotion ? 0 : 900);
  if (isMobileDevice) { const configure = document.getElementById('diag-configure'); configure.hidden = true; document.getElementById('diag-description').textContent = 'Você está no celular. Quando estiver no computador, faça o check-up completo para identificar as peças.'; }
  async function pollDiagnostic() {
    if (!diagnosticToken) return;
    const syncStatus = document.getElementById('diagnostic-sync-status');
    try {
      const response = await fetch(`/api/device-diagnostics/${diagnosticToken}`, { cache: 'no-store' });
      const result = await response.json();
      if (result.status === 'complete') {
        clearInterval(diagnosticPollTimer); diagnosticPollTimer = null;
        syncStatus.textContent = 'Diagnóstico recebido. Atualizando sua orientação…';
        setDiagnostic({ ...result.data, device: 'desktop' }, 'powershell');
        track('diagnostic_complete', { section: 'diagnostic', source: 'powershell', has_ssd: result.data.disks?.some((disk) => /ssd|nvme|solid/i.test(`${disk.model} ${disk.mediaType}`)) ? 'yes' : 'no', memory_band: result.data.ramGb <= 4 ? 'up_to_4' : result.data.ramGb <= 8 ? '5_to_8' : result.data.ramGb <= 16 ? '9_to_16' : 'over_16' });
        setTimeout(() => { diagnosticDialog.close(); diagnostic?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }); }, 900);
      } else if (result.status === 'expired') { clearInterval(diagnosticPollTimer); syncStatus.textContent = 'A sessão expirou. Feche e gere um novo diagnóstico.'; }
    } catch (_) { syncStatus.textContent = 'Não foi possível verificar agora. Tentaremos novamente automaticamente.'; }
  }
  document.getElementById('diag-configure')?.addEventListener('click', async () => {
    if (isMobileDevice) return;
    track('diagnostic_start', { section: 'diagnostic', detected_device: isMobileDevice ? 'mobile' : 'desktop' });
    if (diagnosticDialog?.showModal) diagnosticDialog.showModal(); else diagnosticDialog?.setAttribute('open', '');
    document.getElementById('diagnostic-sync-status').textContent = 'Criando uma sessão segura…';
    try {
      const response = await fetch('/api/device-diagnostics/session', { method: 'POST' });
      if (!response.ok) throw new Error();
      const session = await response.json(); diagnosticToken = session.token;
      document.getElementById('diagnostic-download').href = session.launcherUrl || session.scriptUrl;
      const scriptFallback = document.getElementById('diagnostic-script'); if (scriptFallback) scriptFallback.href = session.scriptUrl;
      document.getElementById('diagnostic-sync-status').textContent = 'Aguardando o diagnóstico do computador…';
      clearInterval(diagnosticPollTimer); diagnosticPollTimer = setInterval(pollDiagnostic, 2000);
    } catch (_) { document.getElementById('diagnostic-sync-status').textContent = 'Não foi possível criar a sessão. Tente novamente.'; }
  });
  diagnosticDialog?.querySelector('.dialog-close')?.addEventListener('click', () => diagnosticDialog.close());
  diagnosticDialog?.addEventListener('click', (event) => { if (event.target === diagnosticDialog) diagnosticDialog.close(); });
  document.getElementById('diagnostic-check-now')?.addEventListener('click', pollDiagnostic);
  document.getElementById('copy-powershell')?.addEventListener('click', async (event) => { try { await navigator.clipboard.writeText(document.getElementById('powershell-command').textContent); event.currentTarget.textContent = 'Copiado'; setTimeout(() => { event.currentTarget.textContent = 'Copiar'; }, 1600); } catch (_) { event.currentTarget.textContent = 'Selecione o comando'; } });
  document.getElementById('diagnostic-download')?.addEventListener('click', () => track('diagnostic_script_download', { section: 'diagnostic', platform: 'windows' }));
  const scriptDialog = document.getElementById('script-dialog');
  document.getElementById('diagnostic-script')?.addEventListener('click', async () => {
    const code = document.getElementById('script-code'); code.textContent = 'Carregando código…';
    if (scriptDialog?.showModal) scriptDialog.showModal();
    try { const response = await fetch(`/api/device-diagnostics/${diagnosticToken}/script`, { cache: 'no-store' }); code.textContent = response.ok ? await response.text() : 'Sessão expirada. Gere um novo diagnóstico.'; } catch (_) { code.textContent = 'Não foi possível carregar o código.'; }
  });
  scriptDialog?.querySelector('.dialog-close')?.addEventListener('click', () => scriptDialog.close());

  const depths = [25, 50, 75, 90, 100];
  function checkDepth() { const max = document.documentElement.scrollHeight - innerHeight; const value = max > 0 ? Math.round((scrollY / max) * 100) : 100; depths.forEach((depth) => { const key = `depth_${depth}`; if (value >= depth && !seen.has(key)) { seen.add(key); track('scroll_depth', { percent_scrolled: depth }); } }); }
  addEventListener('scroll', checkDepth, { passive: true });

  let engagedSeconds = 0; let lastActivity = Date.now(); const engagementMarks = [30, 60, 120];
  ['scroll', 'pointerdown', 'keydown'].forEach((name) => addEventListener(name, () => { lastActivity = Date.now(); }, { passive: true }));
  setInterval(() => { if (!document.hidden && Date.now() - lastActivity < 15000) { engagedSeconds += 5; if (engagementMarks.includes(engagedSeconds)) track('engagement_time', { seconds: engagedSeconds }); } }, 5000);

  const form = document.getElementById('contact-form'); const status = document.getElementById('form-status'); let formStarted = false;
  if (form) {
    form.elements.startedAt.value = Date.now();
    form.addEventListener('input', () => { if (!formStarted) { formStarted = true; track('contact_form_start', { section: 'contact' }); } }, { once: true });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); status.className = 'form-status';
      if (!form.checkValidity()) { form.reportValidity(); status.textContent = 'Revise os campos obrigatórios.'; track('contact_form_error', { section: 'contact', error_type: 'validation' }); return; }
      const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Enviando…'; track('contact_form_submit', { section: 'contact' });
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await response.json();
        if (!response.ok) throw new Error(result.code || 'delivery_failed');
        status.textContent = 'Mensagem enviada. A InfoCore retornará pelo contato informado.'; status.classList.add('success'); form.reset(); form.elements.startedAt.value = Date.now(); analytics?.trackConversion('contact_form_success', { section: 'contact' });
      } catch (error) { status.textContent = error.message === 'not_configured' ? 'O formulário ainda não está conectado. Use o WhatsApp para falar agora.' : 'Não foi possível enviar. Tente novamente ou use o WhatsApp.'; track('contact_form_error', { section: 'contact', error_type: error.message }); }
      finally { button.disabled = false; button.innerHTML = 'Enviar mensagem <svg><use href="#i-arrow"></use></svg>'; }
    });
  }

  async function loadReviews() {
    if (!appConfig.integrations?.googleReviews) return;
    try { const response = await fetch('/api/reviews'); if (!response.ok) return; const data = await response.json(); if (!data.available) return;
      const summary = document.getElementById('reviews-summary'); const content = document.getElementById('reviews-content'); const link = document.getElementById('reviews-link');
      summary.textContent = `${data.rating.toFixed(1)} de 5, com ${data.count} avaliações publicadas no Google.`; if (data.mapsUrl) link.href = data.mapsUrl;
      const review = data.reviews.find((item) => item.text) || data.reviews[0]; content.innerHTML = review ? `<article class="review-card"><div class="stars" aria-label="${review.rating} de 5 estrelas">${'★'.repeat(review.rating)}${'☆'.repeat(5-review.rating)}</div><p>“${escapeHtml(review.text)}”</p><footer>${review.avatar ? `<img src="${encodeURI(review.avatar)}" alt="" width="36" height="36" loading="lazy">` : ''}<span><strong>${escapeHtml(review.name)}</strong><small>${escapeHtml(review.date)}</small></span></footer></article>` : `<div><div class="rating-big">${data.rating.toFixed(1)}</div><div class="stars">★★★★★</div><span class="rating-count">${data.count} avaliações no Google</span></div>`;
    } catch (_) {}
  }
  async function loadInstagram() {
    if (!appConfig.integrations?.instagram) return;
    try { const response = await fetch('/api/instagram'); if (!response.ok) return; const data = await response.json(); if (!data.posts?.length) return; const feed = document.getElementById('instagram-feed'); feed.classList.add('has-posts'); feed.innerHTML = data.posts.slice(0, 6).map((post) => `<a class="instagram-post" href="${encodeURI(post.permalink)}" target="_blank" rel="noopener" data-post-id="${escapeHtml(post.id)}"><img src="${encodeURI(post.imageUrl)}" alt="${escapeHtml((post.caption || 'Publicação da InfoCore').slice(0,120))}" width="500" height="500" loading="lazy"><span>${escapeHtml((post.caption || 'Ver publicação').slice(0,90))}</span></a>`).join(''); feed.addEventListener('click', (event) => { const post = event.target.closest('.instagram-post'); if (post) { track('portfolio_interaction', { section: 'portfolio', item: post.dataset.postId, action: 'open_instagram_post' }); track('instagram_click', { section: 'portfolio', item: post.dataset.postId }); } }); }
    catch (_) {}
  }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value || ''); return div.innerHTML; }
  loadReviews(); loadInstagram();

  const consentPanel = document.getElementById('consent'); const consentSettings = consentPanel?.querySelector('.consent-settings'); const saveButton = consentPanel?.querySelector('.consent-save');
  if (consentPanel && !analytics?.getConsent()) { consentPanel.hidden = false; }
  function applyConsent(choice) { analytics?.setConsent(choice); consentPanel.hidden = true; }
  consentPanel?.addEventListener('click', (event) => { const action = event.target.closest('[data-consent]')?.dataset.consent; if (action === 'accept') applyConsent({ analytics: true, marketing: true }); if (action === 'reject') applyConsent({ analytics: false, marketing: false }); if (action === 'settings') { consentSettings.hidden = false; saveButton.hidden = false; event.target.hidden = true; } if (action === 'save') applyConsent({ analytics: document.getElementById('consent-analytics').checked, marketing: document.getElementById('consent-marketing').checked }); });
  document.getElementById('cookie-settings')?.addEventListener('click', () => { const current = analytics?.getConsent() || {}; document.getElementById('consent-analytics').checked = !!current.analytics; document.getElementById('consent-marketing').checked = !!current.marketing; consentSettings.hidden = false; saveButton.hidden = false; consentPanel.hidden = false; });

  if (!reducedMotion && matchMedia('(pointer:fine)').matches) { const shell = document.getElementById('diagnostic'); shell?.addEventListener('pointermove', (event) => { const rect = shell.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width - .5; const y = (event.clientY - rect.top) / rect.height - .5; shell.style.transform = `perspective(1000px) rotateY(${x * 3}deg) rotateX(${-y * 3}deg)`; }); shell?.addEventListener('pointerleave', () => { shell.style.transform = ''; }); }
})();
