(function () {
  'use strict';
  const config = window.__INFOCORE_CONFIG__ || { analytics: {} };
  const storageKey = 'infocore_consent_v1';
  const attributionKey = 'infocore_attribution_v1';
  const allowedCampaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });

  function getStored(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function captureAttribution() {
    const existing = getStored(attributionKey) || {};
    const params = new URLSearchParams(location.search);
    const campaign = {};
    allowedCampaignKeys.forEach((key) => { const value = params.get(key); if (value) campaign[key] = value.slice(0, 200); });
    const data = { first_landing_page: existing.first_landing_page || `${location.pathname}${location.search}`, first_referrer: existing.first_referrer || document.referrer || 'direct', ...existing, ...campaign };
    try { sessionStorage.setItem(attributionKey, JSON.stringify(data)); } catch (_) {}
    return data;
  }
  const attribution = captureAttribution();
  let consent = null;
  try { consent = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
  let initialized = false;

  function addScript(src, id) {
    if (!src || document.getElementById(id)) return;
    const script = document.createElement('script'); script.async = true; script.src = src; script.id = id; document.head.appendChild(script);
  }
  function initialize(v) {
    window.gtag('consent', 'update', { analytics_storage: v.analytics ? 'granted' : 'denied', ad_storage: v.marketing ? 'granted' : 'denied', ad_user_data: v.marketing ? 'granted' : 'denied', ad_personalization: v.marketing ? 'granted' : 'denied' });
    const ids = config.analytics || {};
    if (v.analytics) {
      if (ids.gtmId) addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(ids.gtmId)}`, 'infocore-gtm');
      else if (ids.ga4Id) { addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4Id)}`, 'infocore-ga4'); window.gtag('js', new Date()); window.gtag('config', ids.ga4Id, { send_page_view: false }); }
      if (ids.clarityId && !window.clarity) { window.clarity = function () { (window.clarity.q = window.clarity.q || []).push(arguments); }; addScript(`https://www.clarity.ms/tag/${encodeURIComponent(ids.clarityId)}`, 'infocore-clarity'); }
    }
    if (v.marketing && ids.metaPixelId && !window.fbq) {
      window.fbq = function () { window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments); }; window.fbq.queue = []; window.fbq.loaded = true; window.fbq.version = '2.0'; addScript('https://connect.facebook.net/en_US/fbevents.js', 'infocore-meta'); window.fbq('init', ids.metaPixelId);
    }
    if (!initialized && (v.analytics || v.marketing)) { initialized = true; trackEvent('page_view', { page_title: document.title }); if (v.marketing && window.fbq) window.fbq('track', 'PageView'); }
  }
  function clean(params) {
    const safe = {}; Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') safe[key] = typeof value === 'string' ? value.slice(0, 200) : value; }); return safe;
  }
  function trackEvent(event, params) {
    const payload = clean({ event, page_path: location.pathname, device_type: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop', ...attribution, ...params });
    window.dataLayer.push(payload);
    if (consent?.analytics && config.analytics?.ga4Id && !config.analytics?.gtmId) window.gtag('event', event, payload);
    document.dispatchEvent(new CustomEvent('infocore:analytics', { detail: payload }));
  }
  function trackConversion(event, params) {
    trackEvent(event, params);
    if (consent?.marketing && window.fbq) window.fbq('track', event === 'contact_form_success' ? 'Lead' : 'Contact', clean(params));
  }
  function setConsent(next) {
    consent = { analytics: !!next.analytics, marketing: !!next.marketing, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(storageKey, JSON.stringify(consent)); } catch (_) {}
    initialize(consent); document.dispatchEvent(new CustomEvent('infocore:consent', { detail: consent }));
  }
  window.InfoCoreAnalytics = { trackEvent, trackConversion, setConsent, getConsent: () => consent, attribution };
  if (consent) initialize(consent);
})();
