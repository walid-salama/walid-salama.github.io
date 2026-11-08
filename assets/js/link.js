// Visitor page: walks through the steps, verifies, and reveals the locked content.
(function () {
  window.PAGE_STARTED = true;
  const C = window.SITE_CONFIG;
  const root = document.getElementById('app');
  // The post comes from the address itself (/abc12), or from ?s=abc12 on link.html.
  // Apps and copy-paste can add things after the short link, so only its start counts.
  const slugFromPath = () => {
    if (/^\/link(\.html)?\/?$/i.test(location.pathname)) return '';
    const m = location.pathname.match(/^\/([a-z0-9][a-z0-9-]{1,60})/i);
    return m ? m[1].toLowerCase().replace(/-+$/, '') : '';
  };
  const slug = new URLSearchParams(location.search).get('s') || slugFromPath();
  const PASS_KEY = 'miftah_pass';
  const doneKey = `miftah_done_${slug}`;
  const openedKey = `miftah_opened_${slug}`;
  const checkingKey = `miftah_checking_${slug}`;
  const viewKey = `miftah_view_${slug}`;
  const inApp = window.InApp && !new URLSearchParams(location.search).has('nochrome')
    ? window.InApp.detect(navigator.userAgent) : null;

  // The address bar keeps a clean short link, which opens this same page when reloaded.
  if (/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
    const rest = new URLSearchParams(location.search);
    ['s', 'fbclid'].forEach(k => rest.delete(k));
    const qs = rest.toString();
    try { history.replaceState(null, '', `/${slug}${qs ? `?${qs}` : ''}`); } catch (e) {}
  }

  let post = null;
  const state = { done: new Set(), clicked: new Set(), checking: new Set(), msg: {}, busy: null, items: null, unlocking: false };
  // stepId -> time its button was pressed. Saved because phones often reload
  // this tab while the visitor is away in the YouTube app.
  const started = {};
  const timers = {};

  const render = () => {
    root.innerHTML = window.renderLinkCard(post, state);
    document.body.style.cssText = window.bgStyle(post);
    document.body.classList.toggle('reading', !!(state.items && state.items.some(i => i.type === 'article')));
  };

  const message = (title, text, retry) => {
    root.innerHTML = `<div class="empty-state card">${window.uiIcon('lock', 44)}<h1>${window.esc(title)}</h1><p>${window.esc(text)}</p>
      ${retry ? '<a class="btn primary" href="">حاول تاني</a>' : '<a class="btn primary" href="/">الصفحة الرئيسية</a>'}</div>`;
  };

  // Everything about a visit lives as long as its tab. Closing the tab and opening the link
  // again starts over: steps from the beginning, and the counters count again. This tab
  // reloading (phones often do that on the way back from YouTube) stays the same visit.
  const visit = {
    has(k) { try { return !!sessionStorage.getItem(k); } catch (e) { return false; } },
    mark(k) { try { sessionStorage.setItem(k, '1'); } catch (e) {} },
    get(k, d) { try { const v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const saveDone = () => {
    // Verified steps are re-confirmed by the server, so only click steps are remembered here.
    const ids = post.steps.filter(s => !s.verify && state.done.has(s.id)).map(s => s.id);
    visit.set(doneKey, ids);
  };

  async function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = res; s.onerror = () => rej(new Error('gis'));
      document.head.appendChild(s);
    });
  }

  function googleToken() {
    return new Promise((res, rej) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: C.googleClientId,
        scope: 'https://www.googleapis.com/auth/youtube.readonly',
        callback: r => (r.access_token ? res(r.access_token) : rej(new Error('denied'))),
        error_callback: () => rej(new Error('denied')),
      });
      client.requestAccessToken();
    });
  }

  function applyVerified(res) {
    if (res.pass) window.store.set(PASS_KEY, res.pass);
    (res.verified || []).forEach(id => { state.done.add(id); delete state.msg[id]; });
  }

  async function verify(id) {
    state.busy = id; delete state.msg[id]; render();
    try {
      let token;
      if (window.DB.isDemo) {
        // Demo stand-in for Google: counts as subscribed only after pressing the subscribe button.
        token = state.clicked.has(id) ? 'demo-yes' : 'demo-no';
      } else {
        await loadGis();
        token = await googleToken();
      }
      const res = await window.DB.unlock(slug, { token, pass: window.store.get(PASS_KEY, null) });
      applyVerified(res);
      if (!state.done.has(id)) {
        state.msg[id] = res.reason === 'google_error'
          ? { kind: 'err', text: 'تعذر التأكد من يوتيوب. تأكد إنك وافقت على صلاحية يوتيوب وحاول تاني.' }
          : { kind: 'err', text: 'الحساب ده مش مشترك في القناة لسه. اضغط زر الاشتراك الأول، أو اختار الحساب المشترك.' };
      } else if (!window.DB.isDemo) {
        window.google.accounts.oauth2.revoke(token, () => {});
      }
    } catch (e) {
      state.msg[id] = { kind: 'err', text: e.message === 'denied'
        ? 'لازم تختار حساب جوجل وتوافق علشان نتأكد من الاشتراك.'
        : 'حصلت مشكلة في الاتصال. حاول تاني.' };
    }
    state.busy = null;
    render();
  }

  function openStep(id) {
    const step = post.steps.find(s => s.id === id);
    const url = window.safeUrl(window.stepUrl(step));
    if (!url || state.checking.has(id) || (!step.verify && state.done.has(id))) return;
    // The wait starts before leaving: the visitor may not come back to this same page load.
    state.clicked.add(id);
    if (!step.verify) {
      started[id] = Date.now();
      visit.set(checkingKey, started);
      state.checking.add(id);
      scheduleChecks();
    }
    delete state.msg[id];
    render();
    const a = window.getAction(step.action);
    if (a && a.p === 'youtube') {
      // The YouTube app is already signed in, even when the page runs inside Messenger.
      window.InApp.openYouTube(url);
    } else if (inApp) {
      // Apps often block new windows, so the link opens in place. Back returns here.
      location.href = url;
    } else {
      const w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (e) {} } else location.href = url;
    }
  }

  // All steps done: the content opens by itself, with no extra tap.
  function unlockWhenReady() {
    if (post.steps.length && post.steps.every(s => state.done.has(s.id)) && !state.items && !state.unlocking) unlock();
  }

  // Works from the time of the click, so it also runs while the visitor is on YouTube.
  // Hidden tabs can delay timers, so returning to the page checks again right away.
  function scheduleChecks() {
    const wait = (C.checkSeconds || 15) * 1000;
    let finished = false;
    Object.keys(started).forEach(id => {
      const left = wait - (Date.now() - started[id]);
      clearTimeout(timers[id]);
      if (left > 0) { timers[id] = setTimeout(scheduleChecks, left); return; }
      delete started[id];
      state.checking.delete(id);
      state.done.add(id);
      finished = true;
    });
    if (!finished) return;
    visit.set(checkingKey, started);
    saveDone();
    render();
    unlockWhenReady();
  }

  function celebrate() {
    const box = document.createElement('div');
    box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
    const accent = (post.theme && post.theme.accent) || '#10e08a';
    box.innerHTML = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * 360, d = 90 + (i * 37) % 170;
      return `<i style="--a:${a}deg;--d:${d}px;--c:${i % 3 ? accent : '#fff'}"></i>`;
    }).join('');
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1300);
  }

  async function unlock() {
    state.unlocking = true; render();
    try {
      const first = !visit.has(openedKey);
      const res = await window.DB.unlock(slug, { pass: window.store.get(PASS_KEY, null), count: first });
      if (res.ok) {
        if (first) { post.unlocks = (post.unlocks || 0) + 1; visit.mark(openedKey); }
        if (post.steps.length) visit.set(doneKey, post.steps.filter(s => !s.verify).map(s => s.id));
        state.items = res.items || [];
        celebrate();
      } else if (res.reason === 'expired') {
        message('انتهت صلاحية الرابط', 'الرابط ده مبقاش متاح.'); return;
      } else {
        (res.missing || []).forEach(id => {
          state.done.delete(id);
          state.msg[id] = { kind: 'err', text: 'لازم نتأكد من اشتراكك الأول.' };
        });
      }
    } catch (e) {
      window.toast('حصلت مشكلة في الاتصال. حاول تاني.', 'err');
    }
    state.unlocking = false;
    render();
    if (document.body.classList.contains('reading')) window.scrollTo(0, 0);
  }

  // Downloads a file, carrying on from where it stopped when the connection drops or stalls,
  // instead of waiting forever. Gives up after several tries, and the direct link takes over.
  async function fetchResumable(url, onProgress) {
    const STALL_MS = 15000;
    const chunks = [];
    let got = 0, total = 0, type = '', tries = 0;
    for (;;) {
      const ctl = new AbortController();
      let timer;
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctl.abort(), STALL_MS); };
      try {
        arm();
        const res = await fetch(url, { headers: got ? { Range: `bytes=${got}-` } : {}, signal: ctl.signal, cache: 'no-store' });
        if (got && res.status !== 206) { chunks.length = 0; got = 0; }
        if (!res.ok || !res.body) throw new Error('download');
        type = type || res.headers.get('content-type') || 'application/octet-stream';
        if (!total) {
          const range = res.headers.get('content-range');
          total = range ? Number(range.split('/')[1]) || 0 : Number(res.headers.get('content-length')) || 0;
        }
        const reader = res.body.getReader();
        for (;;) {
          arm();
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          onProgress(got, total);
        }
        clearTimeout(timer);
        if (total && got < total) throw new Error('incomplete');
        return new Blob(chunks, { type });
      } catch (e) {
        clearTimeout(timer);
        if (++tries > 6) throw e;
        await new Promise(res => setTimeout(res, 1500));
      }
    }
  }

  // Downloads inside the page so the visitor sees exactly how far it got.
  async function downloadFile(card, item) {
    if (card.dataset.busy) return;
    card.dataset.busy = '1';
    const text = card.querySelector('[data-dl-text]');
    const btn = card.querySelector('[data-dl-btn]');
    const bar = card.querySelector('[data-dl-bar]');
    const original = text.textContent;
    const originalBtn = btn.innerHTML;
    const show = (done, total) => {
      const p = window.progressInfo('جاري التحميل', done, total);
      text.textContent = p.text;
      btn.textContent = p.pct === null ? `${(done / 1048576).toFixed(1)} ميجا` : `${p.pct}%`;
      bar.firstElementChild.style.width = p.pct === null ? '100%' : `${p.pct}%`;
      bar.classList.toggle('unknown', p.pct === null);
    };
    try {
      if (item.value.startsWith('data:')) { card.removeAttribute('data-act'); card.click(); return; }
      // In-app browsers often can't save a file made in the page, so they get the direct link,
      // which the phone's own downloader handles.
      if (inApp || !window.ReadableStream || !window.AbortController) { location.href = card.href; return; }
      bar.hidden = false;
      show(0, 0);
      const blob = await fetchResumable(item.value, show);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      text.textContent = 'تم التحميل! هتلاقي الملف في التنزيلات.';
      btn.innerHTML = `${window.uiIcon('check', 18)} تم`;
      setTimeout(() => { text.textContent = original; btn.innerHTML = originalBtn; bar.hidden = true; }, 5000);
    } catch (e) {
      // Direct link as a fallback, so the visitor still gets the file.
      text.textContent = original;
      btn.innerHTML = originalBtn;
      bar.hidden = true;
      location.href = card.href;
    } finally {
      delete card.dataset.busy;
    }
  }

  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'download') {
      e.preventDefault();
      downloadFile(b, state.items.find(x => x.id === id));
      return;
    }
    if (act === 'open') openStep(id);
    else if (act === 'verify') verify(id);
    else if (act === 'unlock') unlock();
    else if (act === 'copy-text') {
      const ok = await window.copyText(b.dataset.copy || '');
      window.toast(ok ? 'تم النسخ!' : 'تعذر النسخ', ok ? 'ok' : 'err');
      if (ok) { b.classList.add('copied'); setTimeout(() => b.classList.remove('copied'), 1800); }
    } else if (act === 'copy') {
      const it = state.items.find(x => x.id === id);
      const ok = await window.copyText(it ? it.value : '');
      window.toast(ok ? 'تم النسخ!' : 'تعذر النسخ', ok ? 'ok' : 'err');
    } else if (act === 'share') {
      const shortUrl = new URL(encodeURIComponent(slug), new URL('./', location.href)).href;
      const data = { title: post.title, url: shortUrl };
      if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
      else { await window.copyText(shortUrl); window.toast('تم نسخ الرابط!', 'ok'); }
    }
  });

  async function countView() {
    const key = viewKey;
    const params = new URLSearchParams(location.search);
    if (params.has('counted')) {
      // Arrived from Messenger, where this visit was already counted.
      visit.mark(key);
      params.delete('counted');
      const qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
      return;
    }
    if (visit.has(key)) return;
    // Inside the app, wait to see if the visitor moved to Chrome, which counts the visit there.
    if (inApp === 'android') {
      await new Promise(res => setTimeout(res, 6000));
      if (document.hidden) return;
    }
    try {
      await window.DB.registerView(slug);
      visit.mark(key);
      post.views = (post.views || 0) + 1;
    } catch (e) {}
  }

  async function init() {
    if (!slug) return message('الرابط غير صحيح', 'تأكد من الرابط وحاول تاني.');
    try { post = await window.DB.getPost(slug); }
    catch (e) { return message('تعذر الاتصال بالموقع', 'تأكد من الإنترنت وحاول تاني.', true); }
    if (!post) return message('الرابط غير موجود', 'يمكن يكون اتمسح أو الرابط فيه خطأ.');
    if (post.expired) return message('انتهت صلاحية الرابط', 'الرابط ده مبقاش متاح.');

    document.title = `${post.title} | ${C.siteName}`;
    post.steps = post.steps || [];
    visit.get(doneKey, []).forEach(id => {
      if (post.steps.some(s => s.id === id && !s.verify)) state.done.add(id);
    });

    const saved = visit.get(checkingKey, {});
    Object.keys(saved).forEach(id => {
      if (post.steps.some(s => s.id === id && !s.verify) && !state.done.has(id)) {
        started[id] = saved[id];
        state.checking.add(id);
      }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleChecks(); });
    window.addEventListener('focus', scheduleChecks);
    window.addEventListener('pageshow', scheduleChecks);

    // The post appears right away. On a slow connection, the requests below finish behind it.
    render();
    scheduleChecks();

    // Someone already verified before: the lock opens with no extra steps.
    const pass = window.store.get(PASS_KEY, null);
    if (pass && post.steps.some(s => s.verify)) {
      try { applyVerified(await window.DB.unlock(slug, { pass })); render(); } catch (e) {}
    }
    unlockWhenReady();

    const viewsBefore = post.views;
    await countView();
    // Not once the content is open: redrawing would cancel a download in progress.
    if (post.views !== viewsBefore && !state.items && !state.unlocking) render();
  }

  // Still in the app after the jump was tried: offers it by tap, which the app can't ignore.
  function showChromeBar() {
    if (document.hidden || document.querySelector('.chrome-bar')) return;
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'chrome-bar';
    bar.innerHTML = `${window.uiIcon('external', 18)}<span>افتح الرابط في متصفح Chrome</span>`;
    bar.onclick = () => {
      window.InApp.open(inApp, visit.has(viewKey));
      if (inApp === 'ios') {
        setTimeout(() => {
          if (!document.hidden) window.toast('لو Chrome مش متثبت، افتح الرابط من Safari.', 'err');
        }, 1500);
      }
    };
    document.body.prepend(bar);
  }

  // Chrome is tried first. Loading waits a moment, since leaving can cancel requests in progress.
  const leaving = !!slug && !!inApp && window.InApp.autoOpen(inApp);
  setTimeout(init, leaving ? 1200 : 0);
  if (inApp) setTimeout(showChromeBar, 2500);

  // Apps can ignore a jump the visitor didn't tap for, so the first touch on the page
  // (outside the buttons, which do their own thing) asks for Chrome again.
  if (inApp === 'android') {
    const onTouch = e => {
      if (e.target.closest && e.target.closest('button, a, [data-act], [data-slide-track]')) return;
      document.removeEventListener('click', onTouch, true);
      window.InApp.open(inApp, visit.has(viewKey));
    };
    document.addEventListener('click', onTouch, true);
  }
})();
