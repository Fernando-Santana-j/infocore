(function () {
    'use strict';
    const analytics = window.InfoCoreAnalytics;
    const config = window.__INFOCORE_CONFIG__ || {};
    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
    const state = { products: [], category: 'all', query: '', sort: 'featured', stockOnly: false, visible: 24 };
    let refreshTimer;
    const seenProducts = new Set();
    const productObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.dataset.productId;
        if (!seenProducts.has(id)) { seenProducts.add(id); analytics?.trackEvent('product_view', { section: 'catalog', product_id: id }); }
        productObserver.unobserve(entry.target);
    }), { threshold: .35 });
    const grid = document.getElementById('catalog-grid');
    const chips = document.getElementById('category-chips');
    const results = document.getElementById('catalog-results');
    const empty = document.getElementById('catalog-empty');
    const loadMore = document.getElementById('catalog-load-more');
    const categoryThemes = { pc: 'theme-pc', cell: 'theme-cell', laptop: 'theme-laptop', others: 'theme-others' };

    function escapeHtml(value) { const element = document.createElement('div'); element.textContent = String(value || ''); return element.innerHTML; }
    function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'); }
    function safeImage(value) { try { const url = new URL(String(value || ''), location.origin); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } }
    function availability(product) {
        if (product.availability === 'out_of_stock') return { className: 'is-out', label: 'Consulte reposição' };
        if (product.availability === 'low_stock') return { className: 'is-low', label: product.quantity === 1 ? 'Última unidade' : `Últimas ${product.quantity} unidades` };
        return { className: 'is-available', label: 'Disponível' };
    }
    function whatsappUrl(product) {
        const price = product.price > 0 ? ` por ${money.format(product.price)}` : '';
        const message = `Olá! Vi o produto “${product.name}”${price} no catálogo da InfoCore e gostaria de saber mais sobre disponibilidade e compra.`;
        return `https://wa.me/${config.business?.whatsappNumber || '5579991343921'}?text=${encodeURIComponent(message)}`;
    }
    function mediaMarkup(product) {
        const image = safeImage(product.image);
        const fallback = (hidden = false) => `<div class="product-visual" aria-hidden="true"${hidden ? ' hidden' : ''}><span>${escapeHtml(product.emoji || '📦')}</span><i></i><i></i><i></i></div>`;
        return image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" width="640" height="480" loading="lazy" decoding="async">${fallback(true)}` : fallback();
    }
    function cardMarkup(product, index) {
        const stock = availability(product);
        const price = product.price > 0 ? money.format(product.price) : 'Consulte';
        const description = product.description || `${product.categoryLabel} disponível na InfoCore.`;
        return `<article class="catalog-card ${categoryThemes[product.category] || 'theme-others'}" data-product-id="${escapeHtml(product.id)}" style="--card-delay:${Math.min(index, 12) * 35}ms"><div class="catalog-card-media">${mediaMarkup(product)}<span class="catalog-category">${escapeHtml(product.categoryLabel)}</span></div><div class="catalog-card-body"><div class="catalog-stock ${stock.className}"><i></i>${escapeHtml(stock.label)}</div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(description)}</p><div class="catalog-card-bottom"><div class="catalog-price"><small>Preço</small><strong>${escapeHtml(price)}</strong></div><a class="catalog-product-whatsapp" href="${escapeHtml(whatsappUrl(product))}" target="_blank" rel="noopener" aria-label="Consultar ${escapeHtml(product.name)} pelo WhatsApp"><svg><use href="#i-whatsapp-clean"></use></svg><span>${product.availability === 'out_of_stock' ? 'Consultar reposição' : 'Tenho interesse'}</span></a></div></div></article>`;
    }
    function filteredProducts() {
        const query = normalize(state.query);
        const products = state.products.filter((product) => (state.category === 'all' || product.category === state.category)
            && (!state.stockOnly || product.availability !== 'out_of_stock')
            && (!query || normalize(`${product.name} ${product.description} ${product.categoryLabel}`).includes(query)));
        if (state.sort === 'price-asc') products.sort((a, b) => a.price - b.price || collator.compare(a.name, b.name));
        if (state.sort === 'price-desc') products.sort((a, b) => b.price - a.price || collator.compare(a.name, b.name));
        if (state.sort === 'name') products.sort((a, b) => collator.compare(a.name, b.name));
        return products;
    }
    function render() {
        const filtered = filteredProducts();
        const visible = filtered.slice(0, state.visible);
        grid.innerHTML = visible.map(cardMarkup).join('');
        grid.setAttribute('aria-busy', 'false');
        grid.querySelectorAll('.catalog-card-media>img').forEach((image) => image.addEventListener('error', () => {
            const fallback = image.nextElementSibling;
            if (fallback?.classList.contains('product-visual')) fallback.hidden = false;
            image.remove();
        }, { once: true }));
        grid.querySelectorAll('.catalog-card').forEach((card) => productObserver.observe(card));
        grid.querySelectorAll('.catalog-product-whatsapp').forEach((link) => link.addEventListener('click', () => {
            const product = state.products.find((item) => item.id === link.closest('.catalog-card')?.dataset.productId);
            analytics?.trackEvent('product_interest', { section: 'catalog', product_id: product?.id, product_name: product?.name, price: product?.price });
            analytics?.trackConversion('whatsapp_click', { section: 'catalog', product_id: product?.id, product_name: product?.name });
        }));
        results.textContent = `${filtered.length.toLocaleString('pt-BR')} ${filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
        empty.hidden = filtered.length > 0;
        grid.hidden = filtered.length === 0;
        loadMore.hidden = visible.length >= filtered.length;
        if (!loadMore.hidden) loadMore.querySelector('span').textContent = `${filtered.length - visible.length} restantes`;
    }
    function resetVisibleAndRender() { state.visible = 24; render(); }
    async function loadCatalog(attempt = 0, background = false) {
        try {
            const response = await fetch('/api/catalog/products');
            const data = await response.json();
            if (!response.ok || !data.available) {
                if (data.reason === 'catalog_loading' && attempt < 36) {
                    results.textContent = 'Sincronizando o catálogo pela primeira vez…';
                    setTimeout(() => loadCatalog(attempt + 1, background), 5000);
                    return;
                }
                throw new Error('unavailable');
            }
            state.products = Array.isArray(data.products) ? data.products : [];
            if (state.category !== 'all' && !(data.categories || []).some((category) => category.id === state.category)) state.category = 'all';
            document.getElementById('catalog-total').textContent = Number(data.count || state.products.length).toLocaleString('pt-BR');
            document.getElementById('catalog-stock-total').textContent = Number(data.inStockCount || 0).toLocaleString('pt-BR');
            chips.innerHTML = `<button class="${state.category === 'all' ? 'is-active' : ''}" type="button" data-category="all">Todos <span>${Number(data.count || state.products.length).toLocaleString('pt-BR')}</span></button>${(data.categories || []).map((category) => `<button class="${state.category === category.id ? 'is-active' : ''}" type="button" data-category="${escapeHtml(category.id)}">${escapeHtml(category.label)} <span>${Number(category.count).toLocaleString('pt-BR')}</span></button>`).join('')}`;
            render();
            if (!background) analytics?.trackEvent('catalog_view', { section: 'catalog', products_count: state.products.length });
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => loadCatalog(0, true), 60000);
        } catch (_) {
            if (background && state.products.length) { refreshTimer = setTimeout(() => loadCatalog(0, true), 60000); return; }
            grid.innerHTML = '';
            grid.hidden = true;
            empty.hidden = false;
            empty.querySelector('h3').textContent = 'Catálogo temporariamente indisponível';
            empty.querySelector('p').textContent = 'Tente novamente em instantes ou fale com a InfoCore pelo WhatsApp.';
            document.getElementById('clear-filters').hidden = true;
            results.textContent = 'Não foi possível carregar os produtos agora.';
        }
    }

    chips.addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; chips.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button)); resetVisibleAndRender(); analytics?.trackEvent('catalog_filter', { category: state.category }); });
    document.getElementById('catalog-search').addEventListener('input', (event) => { state.query = event.target.value; resetVisibleAndRender(); });
    document.getElementById('catalog-sort').addEventListener('change', (event) => { state.sort = event.target.value; resetVisibleAndRender(); });
    document.getElementById('stock-only').addEventListener('change', (event) => { state.stockOnly = event.target.checked; resetVisibleAndRender(); });
    document.getElementById('clear-filters').addEventListener('click', () => { state.category = 'all'; state.query = ''; state.stockOnly = false; document.getElementById('catalog-search').value = ''; document.getElementById('stock-only').checked = false; chips.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item.dataset.category === 'all')); resetVisibleAndRender(); });
    loadMore.addEventListener('click', () => { state.visible += 24; render(); });
    document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('catalog-search').focus(); } });

    const consentPanel = document.getElementById('consent'); const consentSettings = consentPanel?.querySelector('.consent-settings'); const saveButton = consentPanel?.querySelector('.consent-save');
    if (consentPanel && !analytics?.getConsent()) consentPanel.hidden = false;
    function applyConsent(choice) { analytics?.setConsent(choice); consentPanel.hidden = true; }
    consentPanel?.addEventListener('click', (event) => { const action = event.target.closest('[data-consent]')?.dataset.consent; if (action === 'accept') applyConsent({ analytics: true, marketing: true }); if (action === 'reject') applyConsent({ analytics: false, marketing: false }); if (action === 'settings') { consentSettings.hidden = false; saveButton.hidden = false; event.target.hidden = true; } if (action === 'save') applyConsent({ analytics: document.getElementById('consent-analytics').checked, marketing: document.getElementById('consent-marketing').checked }); });
    document.getElementById('cookie-settings')?.addEventListener('click', () => { const current = analytics?.getConsent() || {}; document.getElementById('consent-analytics').checked = !!current.analytics; document.getElementById('consent-marketing').checked = !!current.marketing; consentSettings.hidden = false; saveButton.hidden = false; consentPanel.hidden = false; });
    document.querySelectorAll('.catalog-header-whatsapp,.catalog-help a,.catalog-mobile-whatsapp').forEach((link) => link.addEventListener('click', () => analytics?.trackConversion('whatsapp_click', { section: 'catalog', cta_label: 'catalog_help' })));
    loadCatalog();
}());
