// Policy pages: fills in the store's contact details from config.js (SITE_CONFIG.legal).
(function () {
  const L = (window.SITE_CONFIG && window.SITE_CONFIG.legal) || {};
  const C = window.SITE_CONFIG || {};
  const set = (key, value, href) => document.querySelectorAll(`[data-legal="${key}"]`).forEach(el => {
    el.textContent = value;
    if (href && el.tagName === 'A') el.href = href;
  });
  const real = v => v && !/FILL_ME|X{3}/.test(v);
  set('business', L.businessName || C.siteName || '');
  set('owner', L.owner || '');
  set('address', L.address || '');
  set('updated', L.updated ? new Date(L.updated).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  if (real(L.email)) set('email', L.email, `mailto:${L.email}`);
  if (real(L.phone)) set('phone', L.phone, `tel:${L.phone.replace(/[^\d+]/g, '')}`);
  const wa = String(L.whatsapp || '').replace(/\D/g, '');
  document.querySelectorAll('[data-legal-row="whatsapp"]').forEach(el => { el.hidden = !wa; });
  if (wa) set('whatsapp', L.whatsapp, `https://wa.me/${wa}`);
  document.querySelectorAll('[data-legal-row="email"]').forEach(el => { el.hidden = !real(L.email); });
  document.querySelectorAll('[data-legal-row="phone"]').forEach(el => { el.hidden = !real(L.phone); });
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
  // The page the visitor is on is marked in the policy menu.
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.legal-nav a').forEach(a => { if (a.getAttribute('href').endsWith(here)) a.setAttribute('aria-current', 'page'); });
})();
