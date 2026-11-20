// The buyer's page after Kashier: waits for the server to confirm the payment (the webhook,
// or a direct check with Kashier), then offers the book. Without an order in the address it
// lists the purchases made on this device.
(function () {
  window.PAGE_STARTED = true;
  const C = window.SITE_CONFIG;
  const { esc, uiIcon: ic } = window;
  const root = document.getElementById('app');
  const q = new URLSearchParams(location.search);
  const id = q.get('o') || '';
  const token = q.get('t') || '';
  const gateway = (q.get('paymentStatus') || '').toUpperCase(); // what Kashier said on the way back (not trusted)
  const ORDERS_KEY = 'miftah_my_orders';
  const UUID = /^[0-9a-f-]{36}$/i;

  // The address keeps only what the page needs, so it can be saved and reopened.
  if (id && token) { try { history.replaceState(null, '', `order.html?o=${id}&t=${token}`); } catch (e) {} }

  const myOrders = () => window.store.get(ORDERS_KEY, []);
  function remember(o) {
    const list = myOrders().filter(x => x.id !== o.id);
    list.unshift({ id: o.id, token, slug: o.slug, title: o.title, at: o.created_at });
    window.store.set(ORDERS_KEY, list.slice(0, 50));
  }

  const shell = inner => { root.innerHTML = `<div class="order-card">${inner}</div>`; };
  const contact = () => {
    const L = C.legal || {};
    return `<p class="order-help">محتاج مساعدة؟ <a href="/contact.html">تواصل معانا</a>${L.email && !/FILL_ME/.test(L.email) ? ` على <a href="mailto:${esc(L.email)}" dir="ltr">${esc(L.email)}</a>` : ''} وابعت رقم الطلب.</p>`;
  };

  function listMine() {
    const list = myOrders();
    shell(`<div class="order-head">${ic('file', 30)}<div><h1>مشترياتي</h1><p class="muted">الكتب اللي اشتريتها من الجهاز ده.</p></div></div>
      ${list.length ? `<ul class="my-orders">${list.map(o => `<li><a href="order.html?o=${esc(o.id)}&t=${esc(o.token)}">
          <span><b dir="auto">${esc(o.title || 'كتاب')}</b><small>${o.at ? window.fmtDate(o.at) : ''}</small></span>${ic('arrow', 18)}</a></li>`).join('')}</ul>`
        : '<p class="muted center">لسه ما اشتريتش كتب من الجهاز ده.</p>'}
      <a class="btn primary wide" href="/">تصفح الكتب</a>${contact()}`);
  }

  let order = null;
  let downloading = false;

  function render() {
    const o = order;
    const cover = window.safeImg(o.cover_url);
    const ref = `<div class="order-ref"><span>رقم الطلب</span><b dir="ltr">${esc(o.id.slice(0, 8).toUpperCase())}</b></div>`;
    const sum = `<div class="order-sum">${window.book3d(cover)}<div><b dir="auto">${esc(o.title)}</b>
      <span>${esc(window.fmtPrice(o.amount))}</span>${o.mode === 'test' ? '<em class="test-tag">وضع تجريبي</em>' : ''}</div></div>`;

    if (o.status === 'paid') {
      // One download, on one device: once it is used, the page says so and offers nothing more.
      if (o.first_download_at && !o.download_open) {
        shell(`<div class="order-ok"><span class="got-seal">${ic('check', 28)}</span>
            <div><h1>الكتاب اتحمّل خلاص</h1><p>اتحمّل يوم ${esc(window.fmtDate(o.first_download_at))}. التحميل مسموح مرة واحدة بس لكل طلب.</p></div></div>
          ${sum}<p class="order-slow">لو الملف ضاع منك أو فيه مشكلة، تواصل معانا ومعاك رقم الطلب.</p>${ref}${contact()}`);
        return;
      }
      const used = !!o.first_download_at;
      shell(`<div class="order-ok"><span class="got-seal">${ic('check', 28)}</span>
          <div><h1>تم الدفع بنجاح</h1><p>شكرًا ليك! الكتاب جاهز للتحميل.</p></div></div>
        ${sum}
        <p class="dl-once">${ic('lock', 16)} <span><b>التحميل مرة واحدة بس، وعلى الجهاز ده بس.</b> اتأكد إن النت كويس وإن عندك مساحة قبل ما تضغط تحميل.${used ? ' لو التحميل وقف، تقدر تعيده من نفس الجهاز خلال 15 دقيقة من أول تحميل.' : ''}</span></p>
        <div class="got-list">${(o.files || []).map(f => `<button class="got got-link got-file dl-btn" data-file="${esc(f.id)}">
            <i class="got-ic">${ic('file', 24)}</i><span><b dir="auto">${esc(f.label || 'الكتاب')}</b><small dir="auto" data-dl-text>${esc(f.fileName || 'PDF')}</small></span>
            <em>${ic('download', 18)} ${used ? 'أعد التحميل' : 'تحميل'}</em></button>`).join('') || '<p class="muted">الملف بيتجهز. تواصل معانا لو ما ظهرش.</p>'}</div>
        ${ref}${contact()}`);
      return;
    }
    if (o.status === 'refunded') {
      shell(`<div class="order-head">${ic('x', 30)}<div><h1>الطلب ده اترجعت فلوسه</h1><p class="muted">التحميل مقفول للطلبات المسترجعة.</p></div></div>${sum}${ref}${contact()}`);
      return;
    }
    if (o.status === 'failed' || (gateway === 'FAILURE' && o.status === 'pending' && giveUp)) {
      shell(`<div class="order-head bad">${ic('x', 30)}<div><h1>الدفع ما تمش</h1><p class="muted">ما اتخصمش منك أي مبلغ. تقدر تحاول تاني.</p></div></div>${sum}
        ${o.slug ? `<a class="btn primary wide" href="/${esc(o.slug)}">حاول تاني</a>` : ''}${ref}${contact()}`);
      return;
    }
    shell(`<div class="order-wait"><div class="unlock-loader"><span class="unlock-ring" aria-hidden="true"></span>${ic('lock', 30)}</div>
        <h1>جاري تأكيد الدفع</h1><p class="muted">ثواني وصفحة التحميل هتفتح لوحدها. متقفلش الصفحة.</p></div>
      ${sum}${giveUp ? `<p class="order-slow">التأكيد اتأخر شوية. لو اتخصم منك المبلغ، الكتاب هيفتح هنا أول ما البوابة تأكد. حدّث الصفحة بعد دقيقة.</p>` : ''}${ref}${contact()}`);
  }

  // Kashier's word on the way back is not proof: only the server's answer counts.
  let giveUp = false;
  async function waitForPayment() {
    const started = Date.now();
    const checks = [4000, 15000, 35000, 70000, 110000]; // moments to ask Kashier directly
    let next = 0;
    while (order.status === 'pending') {
      const waited = Date.now() - started;
      if (waited > 150000) { giveUp = true; render(); return; }
      await new Promise(r => setTimeout(r, 3000));
      if (document.hidden) continue;
      try {
        if (next < checks.length && Date.now() - started >= checks[next]) {
          next++;
          await window.DB.orderAction(id, token, 'check');
        }
        const fresh = await window.DB.getOrder(id, token);
        if (fresh) order = fresh;
      } catch (e) { /* network: next round */ }
      if (gateway === 'FAILURE' && Date.now() - started > 20000) { giveUp = true; }
      render();
      if (giveUp && gateway === 'FAILURE') return;
    }
    if (order.status === 'paid') celebrate();
  }

  function celebrate() {
    const box = document.createElement('div');
    box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = Array.from({ length: 36 }, (_, i) => `<i style="--a:${(i / 36) * 360}deg;--d:${90 + (i * 37) % 170}px;--c:${i % 3 ? '#10e08a' : '#fff'}"></i>`).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1300);
  }

  root.addEventListener('click', async e => {
    const copy = e.target.closest('[data-copy-link]');
    if (copy) {
      const ok = await window.copyText(location.href);
      window.toast(ok ? 'تم نسخ الرابط! احفظه في مكان آمن.' : 'تعذر النسخ', ok ? 'ok' : 'err');
      return;
    }
    const b = e.target.closest('[data-file]');
    if (!b || downloading) return;
    if (!order.first_download_at && !confirm('التحميل مسموح مرة واحدة بس وعلى الجهاز ده بس.\nاتأكد إن النت كويس وإن عندك مساحة كفاية.\n\nنبدأ التحميل؟')) return;
    downloading = true;
    const text = b.querySelector('[data-dl-text]');
    const original = text.textContent;
    text.textContent = 'جاري تجهيز رابط التحميل...';
    try {
      const res = await window.DB.orderAction(id, token, 'file', b.dataset.file);
      text.textContent = 'التحميل بدأ! هتلاقي الملف في التنزيلات.';
      order.downloads = (order.downloads || 0) + 1;
      order.first_download_at = order.first_download_at || new Date().toISOString();
      location.href = res.url;
      setTimeout(render, 6000);
    } catch (err) {
      text.textContent = original;
      window.toast(err.message || 'تعذر التحميل. حاول تاني.', 'err');
    }
    downloading = false;
  });

  async function init() {
    if (!id && !token) return listMine();
    if (!UUID.test(id) || !UUID.test(token)) return shell(`<div class="order-head bad">${ic('x', 30)}<div><h1>الرابط غير صحيح</h1></div></div>${contact()}`);
    try { order = await window.DB.getOrder(id, token); }
    catch (e) { return shell(`<div class="order-head bad">${ic('x', 30)}<div><h1>تعذر الاتصال</h1><p class="muted">تأكد من الإنترنت وحاول تاني.</p></div></div><a class="btn primary wide" href="">حاول تاني</a>`); }
    if (!order) return shell(`<div class="order-head bad">${ic('x', 30)}<div><h1>الطلب مش موجود</h1><p class="muted">اتأكد من الرابط.</p></div></div>${contact()}`);
    remember(order);
    render();
    if (order.status === 'pending') waitForPayment();
  }
  init();
})();
