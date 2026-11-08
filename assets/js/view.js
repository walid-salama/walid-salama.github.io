// Shared helpers and the public card, used by both the visitor page and the editor preview.
(function () {
  const PATHS = {
    lock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
    unlock: '<rect x="4.5" y="11" width="15" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    text: '<path d="M5 6h14M5 11h14M5 16h9"/>',
    article: '<rect x="4" y="3" width="16" height="18" rx="2.500"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    share: '<path d="M12 15V4M8 7.5 12 3.5l4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1h-1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="m21 16-5-5L5 20"/>',
    upload: '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 20h14"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    desktop: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    brush: '<path d="M20 4 10.5 13.5"/><path d="M10.5 13.5c-3-.5-5 1.5-5 4 0 1-.8 1.8-2 2 2.500 1.500 8 1.500 9-3 .3-1.200-.6-2.500-2-3z"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M2.500 9h19M12 9v11M12 9S10 3.500 7.500 4.500 8 9 12 9zm0 0s2-5.500 4.500-4.500S16 9 12 9z"/>',
    logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
  };
  window.uiIcon = (name, size = 20) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  const ic = window.uiIcon;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.esc = esc;

  // Only allow web links in href/src: blocks javascript: and similar.
  window.safeUrl = u => {
    const v = String(u || '').trim();
    if (/^https?:\/\//i.test(v) || /^data:(image\/|application\/pdf)/i.test(v)) return v;
    return '';
  };
  const safeImg = u => (/^(https?:\/\/|data:image\/)/i.test(String(u || '').trim()) ? String(u).trim() : '');
  window.safeImg = safeImg;
  // CSS-safe url() argument
  const cssUrl = u => `url("${u.replace(/["\\\n\r]/g, encodeURIComponent)}")`;

  const nf = new Intl.NumberFormat('ar-EG-u-nu-latn', { notation: 'compact', maximumFractionDigits: 1 });
  window.fmtNum = n => nf.format(Number(n) || 0);

  window.fmtDate = d => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });

  const mb = n => (n / 1048576).toFixed(1);
  // Text and percent for a progress bar. total can be 0 when the server doesn't report a size.
  window.progressInfo = function (verb, done, total) {
    if (!total) return { pct: null, text: `${verb}... ${mb(done)} ميجا` };
    const pct = Math.min(100, Math.round((done / total) * 100));
    return { pct, text: `${verb} ${pct}% (${mb(done)} من ${mb(total)} ميجا)` };
  };

  window.toast = function (msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
  };

  // Visitor pages: blocks selecting and copying the page's text. Fields stay usable, and
  // the copy buttons still work, since they copy through their own hidden field.
  if (document.body && document.body.matches('.home, .link-page')) {
    const isField = el => !!(el && el.closest && el.closest('input, textarea'));
    ['copy', 'cut', 'selectstart', 'dragstart'].forEach(type => document.addEventListener(type, e => {
      if (!isField(e.target) && !isField(document.activeElement)) e.preventDefault();
    }));
    document.addEventListener('contextmenu', e => { if (!isField(e.target)) e.preventDefault(); });
  }

  window.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  };

  window.THEMES = {
    cover: { name: 'من صورة البوست' },
    midnight: { name: 'ليلي', css: 'linear-gradient(160deg,#10151f,#0b0d11 70%)' },
    emerald: { name: 'زمردي', css: 'linear-gradient(160deg,#07342a,#0b0f0f 75%)' },
    royal: { name: 'ملكي', css: 'linear-gradient(160deg,#17235c,#0c0d14 75%)' },
    violet: { name: 'بنفسجي', css: 'linear-gradient(160deg,#3a1560,#0e0b14 75%)' },
    ember: { name: 'ناري', css: 'linear-gradient(160deg,#5a1d10,#100b0a 75%)' },
    plain: { name: 'سادة', css: '#0d0f12' },
  };

  window.ACCENTS = ['#10e08a', '#ffc53d', '#4da3ff', '#ff6b6b', '#c084fc', '#2dd4bf'];

  window.bgStyle = function (post) {
    const key = (post.theme && post.theme.bg) || 'cover';
    if (key === 'cover' && safeImg(post.cover_url)) return `--bg-img:${cssUrl(safeImg(post.cover_url))}`;
    const t = window.THEMES[key] || window.THEMES.midnight;
    return `--bg-css:${t.css || window.THEMES.midnight.css}`;
  };

  const TYPE = {
    url: { icon: 'link', one: 'رابط', many: 'روابط' },
    file: { icon: 'file', one: 'ملف', many: 'ملفات' },
    text: { icon: 'text', one: 'برومبت / نص', many: 'برومبتات / نصوص' },
    article: { icon: 'article', one: 'مقالة', many: 'مقالات' },
  };
  window.ITEM_TYPES = TYPE;

  const TYPE_TAG = { url: 'رابط', file: 'ملف للتحميل', text: 'برومبت جاهز للنسخ', article: 'مقالة كاملة' };

  // Names each thing the visitor will get, so "ملف" alone never leaves them guessing.
  function teaser(summary) {
    if (!summary || !summary.length) return '';
    const rows = summary.map(i => {
      const T = TYPE[i.type] || TYPE.url;
      return `<li><i class="tz-ic">${ic(T.icon, 18)}</i>
        <span><b dir="auto">${esc(i.label || T.one)}</b><small>${TYPE_TAG[i.type] || T.one}</small></span>
        <em class="tz-lock">${ic('lock', 14)} مقفول</em></li>`;
    }).join('');
    return `<div class="teaser"><h3>${ic('gift', 18)} هتحصل على إيه؟</h3><ul class="tz-list">${rows}</ul></div>`;
  }

  function stepHtml(step, s) {
    const a = window.getAction(step.action);
    const pf = a ? window.PLATFORMS[a.p] : window.PLATFORMS.web;
    const done = s.done.has(step.id);
    const m = s.msg[step.id];
    const clicked = s.clicked.has(step.id);
    const checking = s.checking.has(step.id);
    let verify = '';
    if (step.verify && !done) {
      verify = `<button class="verify-btn ${clicked ? 'hot' : ''}" data-act="verify" data-id="${esc(step.id)}" ${s.busy === step.id ? 'disabled' : ''}>
        <span class="g-mark" aria-hidden="true">G</span>
        ${s.busy === step.id ? 'جاري التحقق...' : clicked ? 'اشتركت؟ اضغط هنا للتحقق بحساب جوجل' : 'مشترك من قبل؟ تحقق بحساب جوجل'}
      </button>`;
    }
    return `<div class="step ${done ? 'done' : ''}">
      <button class="step-btn ${checking ? 'checking' : ''}" data-act="open" data-id="${esc(step.id)}" style="--brand:${pf.color};--brand-fg:${pf.fg}" ${checking || (done && !step.verify) ? 'disabled' : ''}>
        ${checking ? '<span class="spinner" aria-hidden="true"></span>' : window.brandIcon(a ? a.p : 'web', 20)}
        <span class="step-txt" dir="auto">${checking ? 'جاري التحقق...' : esc(window.stepText(step) || 'خطوة جديدة')}</span>
        ${done ? `<span class="step-ok">${ic('check', 18)}</span>` : ''}
      </button>
      ${verify}
      ${m ? `<p class="step-msg ${m.kind || ''}" role="alert">${esc(m.text)}</p>` : ''}
    </div>`;
  }

  function itemHtml(it) {
    const label = esc(it.label || (TYPE[it.type] && TYPE[it.type].one) || '');
    if (it.type === 'text') {
      return `<div class="got got-text">
        <div class="got-head"><i class="got-ic">${ic('text', 24)}</i>
          <span><b dir="auto">${label}</b><small>انسخه واستخدمه مباشرة</small></span>
          <button class="got-copy" data-act="copy" data-id="${esc(it.id)}">${ic('copy', 18)} نسخ</button></div>
        <pre dir="auto">${esc(it.value)}</pre></div>`;
    }
    const url = window.safeUrl(it.value);
    if (!url) return '';
    if (it.type === 'file') {
      const href = url.includes('/storage/v1/object/') ? `${url}?download=${encodeURIComponent(it.fileName || 'file')}` : url;
      return `<a class="got got-link got-file" data-act="download" data-id="${esc(it.id)}" href="${esc(href)}" download="${esc(it.fileName || '')}" target="_blank" rel="noopener">
        <i class="got-ic">${ic('file', 24)}</i><span><b dir="auto">${label}</b><small dir="auto" data-dl-text>${esc(it.fileName || 'ملف')}</small></span><em data-dl-btn>${ic('download', 18)} تحميل</em>
        <i class="pbar" data-dl-bar hidden><i></i></i></a>`;
    }
    const host = new URL(url).hostname.replace(/^www\./, '');
    return `<a class="got got-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
      <i class="got-ic">${ic('link', 24)}</i><span><b dir="auto">${label}</b><small dir="ltr">${esc(host)}</small></span><em>${ic('external', 18)} فتح</em></a>`;
  }

  // The locked side: says plainly what to do, and that the content then opens by itself.
  function gateHtml(steps, s, doneCount, total) {
    const firstAction = window.getAction(steps[0].action);
    const onYouTube = firstAction && firstAction.p === 'youtube';
    const single = total === 1;
    return `<div class="gate">
      <div class="gate-head"><span class="gate-lock">${ic('lock', 26)}</span>
        <div><h2>المحتوى مقفول</h2>
          <p>${single && onYouTube ? 'اشترك في القناة، والمحتوى هيتفتح لك تلقائيًا.' : 'نفّذ الخطوات دي، والمحتوى هيتفتح لك تلقائيًا.'}</p></div></div>
      ${single ? '' : `<div class="prog"><span>الخطوات</span><b>${doneCount}/${total}</b>
        <i style="--p:${(doneCount / total) * 100}%"></i></div>`}
      <div class="steps">${steps.map(x => stepHtml(x, s)).join('')}</div>
      <ol class="gate-how">
        <li>${onYouTube ? 'اضغط الزر وهيفتح لك يوتيوب' : 'اضغط الزر ونفّذ المطلوب'}</li>
        <li>${onYouTube ? 'اشترك في القناة وارجع للصفحة دي' : 'ارجع للصفحة دي'}</li>
        <li>المحتوى هيتفتح لوحده <strong>مجانًا</strong></li>
      </ol>
    </div>`;
  }

  // An article takes the whole page, with no card around it. Any other content follows it.
  function articlePage(post, items, cover, chips, accent) {
    const articles = items.filter(i => i.type === 'article');
    const others = items.filter(i => i.type !== 'article');
    const parts = articles.map(a => ({ item: a, parsed: window.Article.parse(a.value, a.label) }));
    const first = parts[0];
    const title = first.item.label || first.parsed.title || post.title;
    const body = parts.map((p, i) => {
      const heading = i ? (p.item.label || p.parsed.title) : '';
      return `${heading ? `<h2 dir="auto">${esc(heading)}</h2>` : ''}${p.parsed.html}`;
    }).join('<hr>');
    return `<article class="art-page" style="--accent:${esc(accent)}">
      <header class="art-hero">
        <h1 dir="auto">${esc(title)}</h1>
        <div class="art-meta"><div class="chips">${chips}</div>
          <button class="round" data-act="share" aria-label="مشاركة الرابط">${ic('share', 20)}</button></div>
      </header>
      ${cover ? `<img class="art-cover" src="${esc(cover)}" alt="">` : ''}
      <div class="art-body">${body}</div>
      ${others.length ? `<section class="art-extras"><div class="got-list">${others.map(itemHtml).join('')}</div></section>` : ''}
    </article>`;
  }

  // state: {done:Set, clicked:Set, msg:{}, busy, items, unlocking, preview}
  window.renderLinkCard = function (post, state) {
    const s = Object.assign({ done: new Set(), clicked: new Set(), checking: new Set(), msg: {}, busy: null, items: null, unlocking: false }, state);
    const theme = post.theme || {};
    const steps = post.steps || [];
    const total = steps.length;
    const doneCount = steps.filter(x => s.done.has(x.id)).length;
    const ready = doneCount === total;
    const cover = safeImg(post.cover_url);
    const chips = [
      theme.hideUnlocks ? '' : `<span class="chip">${ic('unlock', 15)}<b>${window.fmtNum(post.unlocks)}</b> فتحوا الرابط</span>`,
      theme.hideViews ? '' : `<span class="chip">${ic('eye', 15)}<b>${window.fmtNum(post.views)}</b> مشاهدة</span>`,
    ].join('');
    const opened = !!s.items;
    if (opened && s.items.some(i => i.type === 'article')) {
      return articlePage(post, s.items, cover, chips, theme.accent || '#10e08a');
    }
    const cardClass = ['lk-card', cover ? '' : 'no-cover', opened && s.items.some(i => i.type === 'text') ? 'has-text' : ''].join(' ').trim();
    return `<article class="${cardClass}" style="--accent:${esc(theme.accent || '#10e08a')}">
      <div class="lk-info">
        ${cover ? `<img class="lk-cover" src="${esc(cover)}" alt="">` : ''}
        <div class="lk-head">
          <h1 dir="auto">${esc(post.title) || 'عنوان البوست'}</h1>
          <button class="round" data-act="share" aria-label="مشاركة الرابط">${ic('share', 20)}</button>
        </div>
        <div class="chips">${chips}</div>
        ${post.description ? `<p class="lk-desc" dir="auto">${esc(post.description)}</p>` : ''}
        ${opened ? '' : teaser(post.items_summary)}
      </div>
      <div class="lk-side ${!opened && ready ? 'is-ready' : ''}">
        ${opened ? `<div class="got-title"><span class="got-seal">${ic('check', 24)}</span>
            <div><h2>تم فتح المحتوى</h2><p>كل حاجة جاهزة ليك هنا.</p></div></div>
          <div class="got-list">${s.items.map(itemHtml).join('') || '<p class="muted">لا يوجد محتوى بعد.</p>'}</div>`
        : ready && s.unlocking ? `<div class="ready-panel unlocking" role="status" aria-live="polite">
            <div class="unlock-loader"><span class="unlock-ring" aria-hidden="true"></span>${ic('unlock', 30)}</div>
            <h2>تم التحقق بنجاح</h2>
            <p>جاري فتح المحتوى، ثواني وكل حاجة هتكون جاهزة...</p>
            <span class="unlock-bar" aria-hidden="true"><i></i></span>
          </div>`
        : ready ? `<div class="ready-panel enter" role="status">
            <span class="ready-seal">${ic('unlock', 40)}</span>
            <h2>${total ? 'تم التحقق بنجاح' : 'المحتوى جاهز'}</h2>
            <p>${total ? 'كده كل حاجة تمام، المحتوى جاهز ليك.' : 'اضغط على الزر علشان تحصل عليه.'}</p>
            <button class="unlock-btn ready" data-act="unlock" ${s.unlocking ? 'disabled' : ''}>
              ${s.unlocking ? '<span class="spinner" aria-hidden="true"></span>' : ic('unlock', 24)}
              <span>${s.unlocking ? 'جاري الفتح...' : esc(theme.unlockLabel || 'افتح المحتوى')}</span>
            </button>
          </div>`
        : gateHtml(steps, s, doneCount, total)}
      </div>
    </article>`;
  };
})();
