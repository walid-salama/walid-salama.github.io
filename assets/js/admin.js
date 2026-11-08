// Dashboard: statistics, the list of links, and the create/edit screen.
(function () {
  const C = window.SITE_CONFIG;
  const DB = window.DB;
  const { esc, uiIcon: ic, toast, fmtNum, fmtDate, copyText } = window;
  const app = document.getElementById('app');

  // Short link: 404.html turns /my-link into the post page.
  const linkFor = slug => new URL(encodeURIComponent(slug), new URL('./', location.href)).href;
  // These names already belong to real pages, so they can't be used as short links.
  const RESERVED_SLUGS = ['index', 'link', 'admin', '404', 'assets', 'supabase', 'readme', 'files', 'functions'];
  const googleReady = () => DB.isDemo || !!C.googleClientId;
  const newId = () => Math.random().toString(36).slice(2, 10);

  let dirty = false;
  let filter = 'all';
  let posts = [];
  let draft = null;

  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------- routing
  let lastHash = location.hash;
  window.addEventListener('hashchange', () => {
    if (dirty && !confirm('فيه تعديلات لم تُحفظ. تخرج بدون حفظ؟')) {
      history.replaceState(null, '', lastHash || '#/');
      return;
    }
    dirty = false;
    route();
  });

  async function route() {
    lastHash = location.hash;
    const h = location.hash.replace(/^#\/?/, '');
    if (h === 'new') return openEditor(blankDraft());
    if (h.startsWith('edit/')) {
      const p = await DB.getFull(h.slice(5));
      if (!p) { location.hash = '#/'; return; }
      return openEditor(p);
    }
    return showList();
  }

  // ------------------------------------------------------------------ login
  function showLogin(note) {
    app.innerHTML = `<form class="card login" id="loginForm">
      <div class="logo big"><img class="logo-mark" src="assets/app/logo.jpg" alt=""><span>${esc(C.siteName)}</span></div>
      <h1>تسجيل دخول لوحة التحكم</h1>
      ${note ? `<p class="form-err" role="alert">${esc(note)}</p>` : ''}
      <label class="fld"><span>البريد الإلكتروني</span><input type="email" name="email" dir="ltr" required autocomplete="username"></label>
      <label class="fld"><span>كلمة المرور</span><input type="password" name="password" dir="ltr" required autocomplete="current-password"></label>
      <button class="btn primary wide">دخول</button>
    </form>`;
    document.getElementById('loginForm').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try { await DB.signIn(f.get('email'), f.get('password')); start(); }
      catch { showLogin('البريد أو كلمة المرور غير صحيحة.'); }
    };
  }

  // ------------------------------------------------------------------- list
  async function showList() {
    app.innerHTML = '<div class="loading"></div>';
    try { posts = await DB.listAll(); }
    catch { app.innerHTML = '<div class="card empty-state"><h2>تعذر تحميل البيانات</h2><p>تأكد من الاتصال وحاول تاني.</p></div>'; return; }
    renderList();
  }

  function renderList() {
    const views = posts.reduce((a, p) => a + Number(p.views || 0), 0);
    const unlocks = posts.reduce((a, p) => a + Number(p.unlocks || 0), 0);
    const rate = views ? Math.round((unlocks / views) * 100) : 0;
    const shown = posts.filter(p => filter === 'all' || p.status === filter);
    const FILTERS = [['all', 'الكل'], ['public', 'عام'], ['private', 'خاص'], ['draft', 'مسودات']];
    const STATUS = { public: 'عام', private: 'خاص', draft: 'مسودة' };

    const needsStore = !DB.isDemo && window.GitHubStore && !window.GitHubStore.ready();
    app.innerHTML = `
      ${needsStore ? `<div class="card store-note">${ic('upload', 22)}
        <span><b>اربط التخزين على GitHub</b><small>علشان ترفع الكتب والصور من اللوحة من غير ما تستهلك حد Supabase المجاني.</small></span>
        <button class="btn primary sm" data-act="storage">اربط دلوقتي</button></div>` : ''}
      <div class="page-head">
        <h1>${ic('unlock', 30)} روابط الفتح</h1>
        <a class="btn primary" href="#/new">${ic('plus', 20)} رابط جديد</a>
      </div>
      <section class="stats" aria-label="الإحصائيات">
        <div class="stat hero-stat"><span>إجمالي المشاهدات</span><b>${fmtNum(views)}</b><small>${views.toLocaleString('en')} مشاهدة</small></div>
        <div class="stat"><span>مرات الفتح</span><b>${fmtNum(unlocks)}</b></div>
        <div class="stat"><span>نسبة الفتح</span><b>${rate}%</b></div>
        <div class="stat"><span>عدد الروابط</span><b>${posts.length}</b></div>
      </section>
      <div class="seg filters" role="tablist">
        ${FILTERS.map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}
      </div>
      <div class="card list">
        ${shown.length ? `<div class="row row-head"><span>الرابط</span><span>المشاهدات</span><span>فتحوا</span><span>تاريخ الإنشاء</span><span></span></div>` : ''}
        ${shown.map(p => {
          const img = window.safeImg(p.cover_url);
          const expired = p.expires_at && new Date(p.expires_at) < new Date();
          return `<div class="row">
            <a class="row-main" href="#/edit/${esc(p.id)}">
              ${img ? `<img src="${esc(img)}" alt="">` : `<span class="thumb-ph">${ic('image', 20)}</span>`}
              <span class="row-title"><b dir="auto">${esc(p.title) || 'بدون عنوان'}</b>
                <small class="tag ${p.status}">${STATUS[p.status]}</small>${expired ? '<small class="tag draft">منتهي</small>' : ''}</span>
            </a>
            <span class="num views" data-label="المشاهدات">${ic('eye', 16)} ${fmtNum(p.views)}</span>
            <span class="num" data-label="فتحوا">${ic('unlock', 16)} ${fmtNum(p.unlocks)}</span>
            <span class="date">${fmtDate(p.created_at)}</span>
            <span class="row-acts">
              <button class="icon-btn" data-act="copy" data-slug="${esc(p.slug)}" title="نسخ الرابط" aria-label="نسخ الرابط">${ic('copy', 18)}</button>
              <a class="icon-btn" href="link.html?s=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="فتح الصفحة" aria-label="فتح الصفحة">${ic('external', 18)}</a>
              <button class="icon-btn" data-act="dup" data-id="${esc(p.id)}" title="نسخة مكررة" aria-label="نسخة مكررة">${ic('dup', 18)}</button>
              <button class="icon-btn danger" data-act="del" data-id="${esc(p.id)}" title="حذف" aria-label="حذف">${ic('trash', 18)}</button>
            </span>
          </div>`;
        }).join('') || `<div class="empty-state">${ic('lock', 40)}<h2>لا توجد روابط هنا</h2><p>اعمل أول رابط واجمع مشتركين جدد.</p><a class="btn primary" href="#/new">${ic('plus', 18)} رابط جديد</a></div>`}
      </div>`;

    app.onclick = async e => {
      const f = e.target.closest('[data-filter]');
      if (f) { filter = f.dataset.filter; renderList(); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'storage') { openStorage(); return; }
      if (b.dataset.act === 'copy') {
        const ok = await copyText(linkFor(b.dataset.slug));
        toast(ok ? 'تم نسخ الرابط!' : 'تعذر النسخ', ok ? 'ok' : 'err');
      } else if (b.dataset.act === 'del') {
        const p = posts.find(x => x.id === b.dataset.id);
        confirmDialog(`حذف "${p.title || 'بدون عنوان'}"؟`, 'الحذف نهائي، والرابط هيتوقف عند كل اللي معاهم.', 'احذف', async () => {
          await DB.deletePost(p.id);
          toast('تم الحذف', 'ok');
          showList();
        });
      } else if (b.dataset.act === 'dup') {
        const p = await DB.getFull(b.dataset.id);
        const { id, views, unlocks, created_at, updated_at, ...rest } = p;
        await DB.savePost({ ...rest, slug: window.randomSlug(), title: `${p.title} (نسخة)`, status: 'draft' });
        toast('تم عمل نسخة كمسودة', 'ok');
        showList();
      }
    };
  }

  function confirmDialog(title, text, action, onYes) {
    const d = document.createElement('dialog');
    d.className = 'modal small';
    d.innerHTML = `<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="modal-acts"><button class="btn" data-no>إلغاء</button><button class="btn danger" data-yes>${esc(action)}</button></div>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-no]').onclick = () => d.close();
    d.querySelector('[data-yes]').onclick = async () => {
      try { await onYes(); } catch { toast('حصلت مشكلة. حاول تاني.', 'err'); }
      d.close();
    };
  }

  // ----------------------------------------------------------------- editor
  function blankDraft() {
    return {
      slug: window.randomSlug(), title: '', description: '', cover_url: '', status: 'public',
      steps: C.defaultChannel ? [{ id: newId(), action: 'yt_subscribe', target: C.defaultChannel, verify: googleReady() }] : [],
      theme: { bg: 'cover', accent: '#10e08a' }, expires_at: null, items: [],
    };
  }

  const toLocalInput = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  function openEditor(p) {
    draft = p;
    draft.theme = draft.theme || {};
    draft.items = draft.items || [];
    draft.steps = draft.steps || [];
    app.onclick = null;
    const t = draft.theme;

    app.innerHTML = `
    <div class="page-head sticky">
      <h1>${ic('unlock', 28)} ${draft.id ? 'تعديل الرابط' : 'إنشاء رابط جديد'}</h1>
      <div class="head-acts">
        <a class="btn" href="#/">رجوع</a>
        <button class="btn primary" id="saveBtn">${ic('check', 20)} ${draft.id ? 'حفظ التعديلات' : 'إنشاء الرابط'}</button>
      </div>
    </div>
    <div class="ed-grid">
      <div class="ed-form">

        <section class="card pad">
          <h2>البوست</h2>
          <label class="fld"><span>العنوان</span>
            <input data-f="title" value="${esc(draft.title)}" placeholder="مثال: حزمة البرومبتات الاحترافية" dir="auto" maxlength="200"></label>
          <label class="fld"><span>الوصف</span>
            <textarea data-f="description" rows="3" placeholder="اكتب أي كلام عايز المشاهد يقراه" dir="auto">${esc(draft.description)}</textarea></label>
          <div class="fld"><span>صورة البوست</span><div id="cover"></div></div>
        </section>

        <section class="card pad">
          <div class="sec-head"><div><h2>المحتوى المقفول</h2>
            <p class="muted">أضف أي عدد من الروابط والملفات والبرومبتات. المشاهد هيحصل عليها كلها مع بعض.</p></div></div>
          <div class="seg add-item">
            <button data-add="url">${ic('link', 18)} رابط موقع</button>
            <button data-add="file">${ic('file', 18)} ملف PDF</button>
            <button data-add="text">${ic('text', 18)} برومبت / نص</button>
            <button data-add="article">${ic('article', 18)} مقالة</button>
          </div>
          <div id="items" class="sort-list"></div>
        </section>

        <section class="card pad">
          <div class="sec-head"><div><h2>الإجراءات المطلوبة</h2>
            <p class="muted">اللي لازم المشاهد يعمله علشان يفتح القفل، بنفس الترتيب. اسحب لإعادة الترتيب.</p></div></div>
          ${C.defaultChannel ? `<div class="quick"><span class="muted">إضافة سريعة</span>
            <button class="quick-chip" id="quickAdd">${window.brandIcon('youtube', 16)} <bdi dir="ltr">${esc(C.defaultChannel)}</bdi></button></div>` : ''}
          <div id="steps" class="sort-list"></div>
          <button class="add-step" id="addStep">${ic('plus', 18)} إضافة إجراء <b id="stepCount"></b></button>
        </section>

        <section class="card accordion">
          <details>
            <summary>${ic('sliders', 20)} التخصيص</summary>
            <div class="acc-body">
              <div class="fld"><span>حالة الرابط</span>
                <div class="seg" id="statusSeg">
                  ${[['public', 'عام', 'يظهر في الصفحة الرئيسية'], ['private', 'خاص', 'بالرابط فقط'], ['draft', 'مسودة', 'غير متاح']]
                    .map(([k, l, h]) => `<button data-status="${k}" title="${h}" class="${draft.status === k ? 'on' : ''}">${l}</button>`).join('')}
                </div></div>
              <label class="fld"><span>الرابط المختصر</span>
                <input data-slug value="${esc(draft.slug)}" dir="ltr" maxlength="60" placeholder="my-link">
                <small class="muted" dir="ltr" id="slugPreview"></small></label>
              <label class="fld"><span>نص زر الفتح</span>
                <input data-t="unlockLabel" value="${esc(t.unlockLabel || '')}" placeholder="افتح المحتوى" maxlength="50"></label>
            </div>
          </details>
          <details>
            <summary>${ic('brush', 20)} الخلفية والألوان</summary>
            <div class="acc-body">
              <div class="fld"><span>الخلفية</span><div class="swatches" id="bgs">
                ${Object.entries(window.THEMES).map(([k, v]) => `<button data-bg="${k}" class="swatch ${(t.bg || 'cover') === k ? 'on' : ''}" style="background:${v.css || 'linear-gradient(135deg,#33404f,#12161c)'}">${esc(v.name)}</button>`).join('')}
              </div></div>
              <div class="fld"><span>لون القفل والأزرار</span><div class="accents" id="accents">
                ${window.ACCENTS.map(c => `<button data-accent="${c}" class="${(t.accent || '#10e08a') === c ? 'on' : ''}" style="background:${c}" aria-label="لون ${c}"></button>`).join('')}
              </div></div>
            </div>
          </details>
          <details>
            <summary>${ic('chart', 20)} العدادات الظاهرة للمشاهد</summary>
            <div class="acc-body">
              <label class="check"><input type="checkbox" data-hide="hideViews" ${t.hideViews ? '' : 'checked'}> إظهار عدد المشاهدات</label>
              <label class="check"><input type="checkbox" data-hide="hideUnlocks" ${t.hideUnlocks ? '' : 'checked'}> إظهار عدد اللي فتحوا الرابط</label>
            </div>
          </details>
          <details>
            <summary>${ic('clock', 20)} انتهاء صلاحية الرابط</summary>
            <div class="acc-body">
              <label class="fld"><span>يتوقف الرابط في (اختياري)</span>
                <input type="datetime-local" id="expires" dir="ltr" value="${toLocalInput(draft.expires_at)}"></label>
            </div>
          </details>
        </section>
      </div>

      <aside class="ed-preview">
        <div class="seg pv-toggle">
          <button data-pv="phone" class="on">${ic('phone', 18)} موبايل</button>
          <button data-pv="desktop">${ic('desktop', 18)} كمبيوتر</button>
        </div>
        <div class="pv-frame phone" id="pvFrame"><div class="pv-screen bg-host" id="pv" inert></div></div>
      </aside>
    </div>`;

    renderCover(); renderItems(); renderSteps(); updateSlugPreview(); refreshPreview();
    bindEditor();
  }

  function touch() { dirty = true; refreshPreviewSoon(); }

  let pvTimer;
  const refreshPreviewSoon = () => { clearTimeout(pvTimer); pvTimer = setTimeout(refreshPreview, 120); };

  function refreshPreview() {
    const el = document.getElementById('pv');
    if (!el) return;
    const post = {
      ...draft, views: draft.views || 0, unlocks: draft.unlocks || 0,
      items_summary: draft.items.map(i => ({ type: i.type, label: i.label })),
    };
    el.style.cssText = window.bgStyle(post);
    el.innerHTML = `<div class="lk-root">${window.renderLinkCard(post, {})}</div>`;
    fitDesktop();
  }

  function fitDesktop() {
    const fr = document.getElementById('pvFrame');
    if (!fr || !fr.classList.contains('desktop')) return;
    const screen = document.getElementById('pv');
    screen.style.setProperty('--k', Math.min(1, fr.clientWidth / 980));
    fr.style.height = '';
    requestAnimationFrame(() => {
      fr.style.height = `${Math.ceil(screen.getBoundingClientRect().height) + 4}px`;
    });
  }

  function updateSlugPreview() {
    const el = document.getElementById('slugPreview');
    if (el) el.textContent = linkFor(draft.slug);
  }

  // ---------------------------------------------------------- upload progress
  const uploads = {}; // 'cover' or an item id -> {done, total}

  function barHtml(key) {
    const u = uploads[key];
    const p = window.progressInfo('جاري الرفع', u.done, u.total);
    return `<div class="upbar" data-bar="${esc(key)}"><div class="upbar-top"><b>${p.pct === null ? '' : `${p.pct}%`}</b><span>${esc(p.text)}</span></div>
      <i class="pbar"><i style="width:${p.pct || 0}%"></i></i></div>`;
  }

  function updateBar(key, done, total) {
    uploads[key] = { done, total };
    const el = document.querySelector(`[data-bar="${key}"]`);
    if (el) el.outerHTML = barHtml(key);
  }

  // ------------------------------------------------------------------ cover
  function renderCover() {
    const img = window.safeImg(draft.cover_url);
    if (uploads.cover) { document.getElementById('cover').innerHTML = barHtml('cover'); return; }
    document.getElementById('cover').innerHTML = img
      ? `<div class="cover-box"><img src="${esc(img)}" alt="صورة البوست">
          <div class="cover-acts"><label class="btn sm">${ic('upload', 16)} تغيير<input type="file" accept="image/*" hidden data-cover-input></label>
          <button class="btn sm danger" data-cover-remove>${ic('trash', 16)} إزالة</button></div></div>`
      : `<label class="drop" data-drop><input type="file" accept="image/*" hidden data-cover-input>
          ${ic('image', 30)}<b>ارفع صورة احترافية للبوست</b><small>اضغط أو اسحب الصورة هنا. أي مقاس ينفع، وهتظهر كاملة</small></label>`;
  }

  async function uploadCover(file) {
    if (!file || !file.type.startsWith('image/')) { toast('اختار ملف صورة', 'err'); return; }
    uploads.cover = { done: 0, total: file.size };
    renderCover();
    try {
      draft.cover_url = await DB.upload(file, 'covers', (d, t) => updateBar('cover', d, t));
      touch();
    } catch (e) { toast(e.message || 'تعذر رفع الصورة', 'err'); }
    delete uploads.cover;
    renderCover();
  }

  // --------------------------------------------------------------- articles
  function articlePreview(it) {
    if (!(it.value || '').trim()) return '<p class="muted">الصق المقالة فوق، وهتشوف شكلها هنا على طول.</p>';
    const parsed = window.Article.parse(it.value, it.label);
    const title = it.label || parsed.title;
    return `${title ? `<h1 class="art-pv-title" dir="auto">${esc(title)}</h1>` : ''}<div class="art-body">${parsed.html}</div>`;
  }

  function articleField(it) {
    const tool = (kind, icon, label) => `<button type="button" data-art="${kind}">${ic(icon, 16)} ${label}</button>`;
    return `<div class="art-tools" role="toolbar" aria-label="أدوات المقالة">
        ${tool('h2', 'text', 'عنوان رئيسي')}
        ${tool('h3', 'text', 'عنوان فرعي')}
        ${tool('bold', 'check', 'عريض')}
        ${tool('code', 'copy', 'رمز للنسخ')}
        ${tool('app', 'download', 'زر تطبيق')}
        ${tool('site', 'external', 'زر موقع')}
        ${tool('file', 'file', 'زر ملف')}
        ${tool('quote', 'text', 'اقتباس')}
        <label class="art-tool-img">${ic('image', 16)} صورة<input type="file" accept="image/*" hidden data-art-image></label>
        <label class="art-tool-img">${ic('image', 16)} صور خطوات<input type="file" accept="image/*" multiple hidden data-art-image></label>
      </div>
      <p class="art-tip">الصق المقالة وهتتنسق لوحدها. ولو عايز تحدد حاجة بنفسك: ظلّل الرمز أو الرابط أو العنوان، واضغط الزر المناسب. وصور الخطوات: اختار كذا صورة مرة واحدة وهتتقلب يمين وشمال بترتيب أسماء الملفات. ولشرح أي صورة، اكتب الشرح بين القوسين [ ] في سطرها.</p>
      <textarea class="art-text" data-item="value" data-art-text rows="14" dir="auto" placeholder="الصق نص المقالة هنا">${esc(it.value || '')}</textarea>
      <p class="art-status" data-art-status hidden></p>
      <div class="art-pv-head">${ic('eye', 16)} شكلها عند الزائر</div>
      <div class="art-preview" data-art-preview>${articlePreview(it)}</div>`;
  }

  function insertAtCursor(ta, text) {
    const s = ta.selectionStart;
    ta.setRangeText(text, s, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return s;
  }

  // Applies a tool to the selected text.
  function applyArticleTool(kind, ta) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const selected = ta.value.slice(s, e).trim();
    if (!selected) { toast('ظلّل النص الأول، وبعدين اضغط الزر.', 'err'); ta.focus(); return; }
    const onOwnLine = t => `${s > 0 && ta.value[s - 1] !== '\n' ? '\n' : ''}${t}${e < ta.value.length && ta.value[e] !== '\n' ? '\n' : ''}`;
    let result;
    if (kind === 'h2' || kind === 'h3') {
      result = onOwnLine(`${kind === 'h2' ? '##' : '###'} ${selected.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ')}`);
    } else if (kind === 'quote') {
      result = onOwnLine(selected.split('\n').map(l => `> ${l}`).join('\n'));
    } else if (kind === 'bold') {
      result = `**${selected}**`;
    } else if (kind === 'code') {
      result = selected.includes('\n') ? onOwnLine(`\`\`\`\n${selected}\n\`\`\``) : `\`${selected.replace(/`/g, '')}\``;
    } else {
      const found = selected.match(/https?:\/\/[^\s)\]]+/i);
      if (!found) { toast('ظلّل الرابط اللي بيبدأ بـ https:// الأول.', 'err'); ta.focus(); return; }
      const clean = t => t.replace(/[[\]()]/g, '').replace(/[:：\-–—>→\s]+$/, '').trim();
      const names = { app: 'تطبيق', site: 'موقع', file: 'ملف' };
      let rest = clean(selected.replace(found[0], ''));
      // Words just before the link on the same line name the button.
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const before = clean(ta.value.slice(lineStart, s));
      if (!rest && before && before.length <= 80) {
        ta.setRangeText(`[${names[kind]}: ${before}](${found[0]})`, lineStart, e, 'end');
        ta.focus();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      result = onOwnLine(`[${names[kind]}: ${rest || window.Article.DEFAULT_LABEL[kind]}](${found[0]})`);
    }
    ta.setRangeText(result, s, e, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Several pictures in a row show as steps that slide sideways, in file name order.
  async function uploadArticleImages(picked, ta) {
    const files = picked.filter(f => f.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!files.length) { toast('اختار ملف صورة', 'err'); return; }
    const status = ta.parentElement.querySelector('[data-art-status]');
    const key = `art-${newId()}`;
    const cursor = ta.selectionStart;
    uploads[key] = { done: 0, total: 1 };
    status.hidden = false;
    const urls = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const counter = files.length > 1 ? ` ${i + 1} من ${files.length}` : '';
        urls.push(await DB.upload(files[i], 'articles', (d, t) => {
          status.textContent = window.progressInfo(`جاري رفع الصورة${counter}`, d, t).text;
        }));
      }
    } catch (err) { toast(err.message || 'تعذر رفع الصورة', 'err'); }
    if (urls.length) {
      ta.setSelectionRange(cursor, cursor);
      insertAtCursor(ta, `\n${urls.map(u => `![](${u})`).join('\n')}\n`);
      toast(urls.length > 1 ? `اتضافت ${urls.length} صور كخطوات` : 'الصورة اتضافت في المقالة', 'ok');
    }
    delete uploads[key];
    status.hidden = true;
  }

  // ------------------------------------------------------------------ items
  function renderItems() {
    const box = document.getElementById('items');
    if (!draft.items.length) {
      box.innerHTML = `<p class="hint-empty">لسه ما ضفتش محتوى. اختار من الأزرار اللي فوق.</p>`;
      return;
    }
    box.innerHTML = draft.items.map(it => {
      const T = window.ITEM_TYPES[it.type];
      let field;
      if (it.type === 'url') {
        field = `<input data-item="value" value="${esc(it.value || '')}" dir="ltr" placeholder="https://..." inputmode="url">`;
      } else if (it.type === 'text') {
        field = `<textarea data-item="value" rows="4" dir="auto" placeholder="اكتب البرومبت أو النص هنا">${esc(it.value || '')}</textarea>`;
      } else if (it.type === 'article') {
        field = articleField(it);
      } else if (uploads[it.id]) {
        field = barHtml(it.id);
      } else {
        field = it.value
          ? `<div class="file-chosen">${ic('file', 18)}<span dir="auto">${esc(it.fileName || 'ملف')}</span>
              <label class="btn sm">تغيير<input type="file" hidden data-item-file></label></div>`
          : `<label class="drop small">${ic('upload', 22)}<b>اختار ملف PDF أو أي ملف آخر</b><input type="file" hidden data-item-file></label>`;
      }
      return `<div class="sort-row item-row" data-id="${esc(it.id)}">
        <span class="grip" title="اسحب لإعادة الترتيب">${ic('grip', 18)}</span>
        <div class="item-fields">
          <div class="item-top"><span class="type-tag">${ic(T.icon, 15)} ${T.one}</span>
            <input data-item="label" value="${esc(it.label || '')}" dir="auto" placeholder="${it.type === 'article' ? 'عنوان المقالة' : 'اسم يظهر للمشاهد'}" maxlength="${it.type === 'article' ? 200 : 100}"></div>
          ${field}
        </div>
        <button class="icon-btn danger" data-item-del aria-label="حذف">${ic('x', 18)}</button>
      </div>`;
    }).join('');
    makeSortable(box, draft.items, renderItems);
  }

  // ------------------------------------------------------------------ steps
  function renderSteps() {
    const box = document.getElementById('steps');
    box.innerHTML = draft.steps.map(s => {
      const a = window.getAction(s.action);
      const pf = window.PLATFORMS[a.p];
      const ph = a.input === 'url' ? 'https://...' : '@اسم_الحساب أو الرابط';
      return `<div class="sort-row step-row" data-id="${esc(s.id)}">
        <span class="grip" title="اسحب لإعادة الترتيب">${ic('grip', 18)}</span>
        <div class="step-fields">
          <div class="step-line">
            <button class="action-pick" data-step-pick>${window.brandIcon(a.p, 18)}<span title="${esc(pf.name)}">${esc(a.label)}</span></button>
            <input data-step-target value="${esc(s.target || '')}" dir="ltr" placeholder="${esc(ph)}" aria-label="الحساب أو الرابط (لا يظهر للمشاهد)">
          </div>
          <input data-step-label value="${esc(s.label || '')}" dir="auto" maxlength="60" placeholder="نص الزر للمشاهد (اختياري): ${esc(a.label)}" aria-label="نص الزر للمشاهد">
          <small class="muted step-note">الحساب أو الرابط مش بيظهر مكتوب للمشاهد، بيظهر له نص الزر بس.</small>
          ${a.verifiable && googleReady() ? `<label class="check verify-check">
              <input type="checkbox" data-step-verify ${s.verify ? 'checked' : ''}>
              تحقق حقيقي من الاشتراك بحساب جوجل</label>` : ''}
        </div>
        <button class="icon-btn danger" data-step-del aria-label="حذف">${ic('x', 18)}</button>
      </div>`;
    }).join('');
    document.getElementById('stepCount').textContent = `${draft.steps.length}/20`;
    const q = document.getElementById('quickAdd');
    if (q) q.classList.toggle('added', draft.steps.some(s => s.action === 'yt_subscribe' && s.target === C.defaultChannel));
    makeSortable(box, draft.steps, renderSteps);
  }

  function makeSortable(box, arr, rerender) {
    let dragId = null;
    box.querySelectorAll('.sort-row').forEach(row => {
      const grip = row.querySelector('.grip');
      grip.onmousedown = () => { row.draggable = true; };
      row.ondragstart = e => { dragId = row.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); row.classList.add('dragging'); };
      row.ondragend = () => { row.draggable = false; row.classList.remove('dragging'); };
      row.ondragover = e => { if (dragId) { e.preventDefault(); row.classList.add('over'); } };
      row.ondragleave = () => row.classList.remove('over');
      row.ondrop = e => {
        e.preventDefault();
        if (!dragId || dragId === row.dataset.id) return;
        const from = arr.findIndex(x => x.id === dragId);
        const to = arr.findIndex(x => x.id === row.dataset.id);
        arr.splice(to, 0, arr.splice(from, 1)[0]);
        dragId = null;
        touch(); rerender();
      };
    });
  }

  // ----------------------------------------------------------- action picker
  function pickAction(onPick) {
    const d = document.createElement('dialog');
    d.className = 'modal picker';
    let cat = 'all', q = '';
    d.innerHTML = `<div class="modal-head"><h2>أضف إجراء</h2><button class="round" data-close aria-label="إغلاق">${ic('x', 20)}</button></div>
      <p class="muted">إيه اللي المشاهد لازم يعمله قبل ما القفل يتفتح؟</p>
      <label class="search">${ic('search', 18)}<input placeholder="ابحث عن منصة أو إجراء" aria-label="بحث"></label>
      <div class="cats"></div><div class="picker-body"></div>`;
    document.body.appendChild(d);
    d.showModal();

    const card = a => `<button class="pick-card" data-pick="${a.id}">${window.brandIcon(a.p, 18)}<span>${esc(a.label)}</span></button>`;
    const draw = () => {
      d.querySelector('.cats').innerHTML = window.ACTION_CATEGORIES.map(([k, l]) =>
        `<button class="${cat === k ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('');
      const match = window.ACTIONS.filter(a => {
        const pf = window.PLATFORMS[a.p];
        return (cat === 'all' || pf.cat === cat) && (!q || `${a.label} ${pf.name}`.includes(q));
      });
      let html = '';
      if (cat === 'all' && !q) {
        html += `<h3>الأكثر استخدامًا</h3><div class="pick-grid">${match.filter(a => a.popular).map(card).join('')}</div>`;
      }
      Object.keys(window.PLATFORMS).forEach(p => {
        const list = match.filter(a => a.p === p);
        if (list.length) html += `<h3>${window.brandIcon(p, 15)} ${esc(window.PLATFORMS[p].name)}</h3><div class="pick-grid">${list.map(card).join('')}</div>`;
      });
      d.querySelector('.picker-body').innerHTML = html || '<p class="muted center">مفيش نتائج.</p>';
    };
    draw();

    d.querySelector('.search input').oninput = e => { q = e.target.value.trim(); draw(); };
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-close]')) return d.close();
      const c = e.target.closest('[data-cat]');
      if (c) { cat = c.dataset.cat; return draw(); }
      const p = e.target.closest('[data-pick]');
      if (p) { onPick(p.dataset.pick); d.close(); }
    });
    d.addEventListener('close', () => d.remove());
  }

  function makeStep(actionId) {
    const a = window.getAction(actionId);
    return {
      id: newId(), action: actionId,
      target: a.p === 'youtube' && a.input === 'handle' ? (C.defaultChannel || '') : '',
      verify: !!a.verifiable && googleReady(),
    };
  }

  // ---------------------------------------------------------------- binding
  function bindEditor() {
    const form = document.querySelector('.ed-form');

    form.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.f) { draft[el.dataset.f] = el.value; touch(); }
      else if (el.dataset.t) { draft.theme[el.dataset.t] = el.value; touch(); }
      else if ('slug' in el.dataset) {
        el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
        draft.slug = el.value; dirty = true; updateSlugPreview();
      } else if (el.dataset.item) {
        const it = draft.items.find(x => x.id === el.closest('.sort-row').dataset.id);
        it[el.dataset.item] = el.value; touch();
        if (it.type === 'article') el.closest('.sort-row').querySelector('[data-art-preview]').innerHTML = articlePreview(it);
      } else if ('stepTarget' in el.dataset) {
        const s = draft.steps.find(x => x.id === el.closest('.sort-row').dataset.id);
        s.target = el.value; touch();
      } else if ('stepLabel' in el.dataset) {
        const s = draft.steps.find(x => x.id === el.closest('.sort-row').dataset.id);
        s.label = el.value; touch();
      } else if (el.id === 'expires') {
        draft.expires_at = el.value ? new Date(el.value).toISOString() : null; dirty = true;
      }
    });

    form.addEventListener('change', async e => {
      const el = e.target;
      if ('stepVerify' in el.dataset) {
        const s = draft.steps.find(x => x.id === el.closest('.sort-row').dataset.id);
        s.verify = el.checked; touch();
      } else if (el.dataset.hide) {
        draft.theme[el.dataset.hide] = !el.checked; touch();
      } else if ('coverInput' in el.dataset) {
        uploadCover(el.files[0]);
      } else if ('artImage' in el.dataset && el.files[0]) {
        uploadArticleImages(Array.from(el.files), el.closest('.sort-row').querySelector('[data-art-text]'));
        el.value = '';
      } else if ('itemFile' in el.dataset && el.files[0]) {
        const row = el.closest('.sort-row');
        const it = draft.items.find(x => x.id === row.dataset.id);
        const file = el.files[0];
        uploads[it.id] = { done: 0, total: file.size };
        renderItems();
        try {
          it.value = await DB.upload(file, 'files', (d, t) => updateBar(it.id, d, t));
          it.fileName = file.name;
          if (!it.label) it.label = file.name.replace(/\.[^.]+$/, '');
          touch();
        } catch (err) { toast(err.message || 'تعذر رفع الملف', 'err'); }
        delete uploads[it.id];
        renderItems();
      }
    });

    form.addEventListener('click', e => {
      const t = e.target;
      const artTool = t.closest('[data-art]');
      if (artTool) {
        applyArticleTool(artTool.dataset.art, artTool.closest('.sort-row').querySelector('[data-art-text]'));
        return;
      }
      const artCopy = t.closest('.art-preview [data-act="copy-text"]');
      if (artCopy) {
        window.copyText(artCopy.dataset.copy || '').then(ok => toast(ok ? 'تم النسخ!' : 'تعذر النسخ', ok ? 'ok' : 'err'));
        return;
      }
      const add = t.closest('[data-add]');
      if (add) {
        draft.items.push({ id: newId(), type: add.dataset.add, label: '', value: '' });
        touch(); renderItems();
        const rows = document.querySelectorAll('#items .sort-row');
        const inp = rows[rows.length - 1]?.querySelector('input[data-item="label"]');
        inp && inp.focus();
        return;
      }
      if (t.closest('[data-item-del]')) {
        draft.items = draft.items.filter(x => x.id !== t.closest('.sort-row').dataset.id);
        touch(); renderItems(); return;
      }
      if (t.closest('[data-step-del]')) {
        draft.steps = draft.steps.filter(x => x.id !== t.closest('.sort-row').dataset.id);
        touch(); renderSteps(); return;
      }
      if (t.closest('[data-step-pick]')) {
        const s = draft.steps.find(x => x.id === t.closest('.sort-row').dataset.id);
        pickAction(id => {
          const a = window.getAction(id);
          s.action = id; s.verify = !!a.verifiable && googleReady();
          touch(); renderSteps();
        });
        return;
      }
      if (t.closest('#addStep')) {
        if (draft.steps.length >= 20) { toast('الحد الأقصى 20 إجراء', 'err'); return; }
        pickAction(id => {
          draft.steps.push(makeStep(id)); touch(); renderSteps();
          const rows = document.querySelectorAll('#steps .sort-row');
          rows[rows.length - 1]?.querySelector('[data-step-target]')?.focus();
        });
        return;
      }
      if (t.closest('#quickAdd')) {
        const i = draft.steps.findIndex(s => s.action === 'yt_subscribe' && s.target === C.defaultChannel);
        if (i >= 0) draft.steps.splice(i, 1); else draft.steps.push(makeStep('yt_subscribe'));
        touch(); renderSteps(); return;
      }
      if (t.closest('[data-cover-remove]')) {
        e.preventDefault(); draft.cover_url = ''; touch(); renderCover(); return;
      }
      const st = t.closest('[data-status]');
      if (st) { draft.status = st.dataset.status; dirty = true; pick('#statusSeg', st); return; }
      const bg = t.closest('[data-bg]');
      if (bg) { draft.theme.bg = bg.dataset.bg; touch(); pick('#bgs', bg); return; }
      const ac = t.closest('[data-accent]');
      if (ac) { draft.theme.accent = ac.dataset.accent; touch(); pick('#accents', ac); }
    });

    // Pasting into an article: a picture is uploaded, and a formatted page keeps its
    // headings and links. Plain text goes in as usual.
    form.addEventListener('paste', e => {
      const ta = e.target;
      if (!('artText' in ta.dataset) || !e.clipboardData) return;
      const html = e.clipboardData.getData('text/html');
      const image = Array.from(e.clipboardData.files || []).find(f => f.type.startsWith('image/'));
      if (image && !html) { e.preventDefault(); uploadArticleImages([image], ta); return; }
      if (html && /<(h[1-6]|a\s|img\s|li|strong|b|blockquote)\b/i.test(html)) {
        const text = window.Article.fromHtml(html);
        if (text) { e.preventDefault(); insertAtCursor(ta, text); }
      }
    });

    const pick = (sel, el) => {
      document.querySelectorAll(`${sel} button`).forEach(b => b.classList.toggle('on', b === el));
    };

    // Drop an image straight onto the cover area.
    const cover = document.getElementById('cover');
    cover.addEventListener('dragover', e => { e.preventDefault(); cover.classList.add('over'); });
    cover.addEventListener('dragleave', () => cover.classList.remove('over'));
    cover.addEventListener('drop', e => { e.preventDefault(); cover.classList.remove('over'); uploadCover(e.dataTransfer.files[0]); });

    document.querySelector('.pv-toggle').addEventListener('click', e => {
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      document.querySelectorAll('.pv-toggle button').forEach(x => x.classList.toggle('on', x === b));
      const fr = document.getElementById('pvFrame');
      fr.className = `pv-frame ${b.dataset.pv}`;
      fr.style.height = '';
      fitDesktop();
    });

    document.getElementById('saveBtn').onclick = save;
  }

  const isWebUrl = v => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };

  function validate() {
    const fail = (msg, sel) => {
      toast(msg, 'err');
      const el = sel && document.querySelector(sel);
      if (el) { el.closest('details')?.setAttribute('open', ''); el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return false;
    };
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(draft.slug)) return fail('الرابط المختصر لازم يكون حرفين على الأقل، إنجليزي وأرقام وشرطات فقط.', '[data-slug]');
    if (RESERVED_SLUGS.includes(draft.slug)) return fail('الاسم ده محجوز للموقع. اختار اسم تاني للرابط المختصر.', '[data-slug]');
    if (draft.status === 'draft') return true;
    if (!draft.title.trim()) return fail('اكتب عنوان البوست.', '[data-f=title]');
    if (!draft.items.length) return fail('أضف عنصر واحد على الأقل في المحتوى المقفول.', '.add-item button');
    for (const it of draft.items) {
      const row = `#items [data-id="${it.id}"]`;
      if (it.type === 'url' && !isWebUrl(it.value)) return fail('اكتب رابط صحيح يبدأ بـ https://', `${row} [data-item=value]`);
      if (it.type === 'text' && !it.value.trim()) return fail('اكتب نص البرومبت.', `${row} [data-item=value]`);
      if (it.type === 'article' && !it.value.trim()) return fail('الصق نص المقالة.', `${row} [data-item=value]`);
      if (it.type === 'file' && !it.value) return fail('ارفع الملف أو احذف العنصر.', row);
    }
    for (const s of draft.steps) {
      const a = window.getAction(s.action);
      const sel = `#steps [data-id="${s.id}"] [data-step-target]`;
      if (!s.target.trim()) return fail(`اكمل بيانات إجراء "${a.label}".`, sel);
      if (a.input === 'url' && !isWebUrl(s.target)) return fail(`إجراء "${a.label}" محتاج رابط كامل يبدأ بـ https://`, sel);
    }
    return true;
  }

  async function save() {
    if (Object.keys(uploads).length) { toast('استنى لما رفع الملفات يخلص.', 'err'); return; }
    if (!validate()) return;
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    const wasNew = !draft.id;
    try {
      const saved = await DB.savePost(draft);
      draft.id = saved.id;
      dirty = false;
      if (wasNew) { history.replaceState(null, '', `#/edit/${saved.id}`); lastHash = location.hash; }
      btn.innerHTML = `${ic('check', 20)} حفظ التعديلات`;
      document.querySelector('.page-head h1').innerHTML = `${ic('unlock', 28)} تعديل الرابط`;
      showSaved();
    } catch (e) {
      if (e.message === 'slug_taken') { toast('الرابط المختصر مستخدم قبل كده. اختار اسم تاني.', 'err'); document.querySelector('[data-slug]').closest('details').open = true; }
      else toast(e.message || 'تعذر الحفظ. حاول تاني.', 'err');
    }
    btn.disabled = false;
  }

  function showSaved() {
    const url = linkFor(draft.slug);
    const d = document.createElement('dialog');
    d.className = 'modal small';
    d.innerHTML = `<div class="saved-ic">${ic('unlock', 34)}</div>
      <h2>${draft.status === 'draft' ? 'تم حفظ المسودة' : 'رابطك المختصر جاهز!'}</h2>
      ${draft.status === 'draft' ? '<p class="muted">الرابط مش هيفتح للمشاهدين غير لما تغيّر الحالة إلى عام أو خاص.</p>' : `<input class="saved-url" readonly dir="ltr" value="${esc(url)}" aria-label="الرابط المختصر">`}
      <div class="modal-acts">
        <button class="btn" data-close>تمام</button>
        ${draft.status === 'draft' ? '' : `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">فتح الصفحة</a>
        <button class="btn primary" data-copy>${ic('copy', 18)} نسخ الرابط المختصر</button>`}
      </div>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-close]').onclick = () => d.close();
    const c = d.querySelector('[data-copy]');
    if (c) c.onclick = async () => { const ok = await copyText(url); toast(ok ? 'تم النسخ!' : 'تعذر النسخ', ok ? 'ok' : 'err'); };
  }

  // ------------------------------------------------------------------ start
  function renderTop(session) {
    document.getElementById('logo').innerHTML = `<img class="logo-mark" src="assets/app/logo.jpg" alt=""><span>${esc(C.siteName)}</span>`;
    const out = document.getElementById('logout');
    out.hidden = DB.isDemo || !session;
    out.innerHTML = `${ic('logout', 18)} خروج`;
    out.onclick = async () => { await DB.signOut(); location.reload(); };
    document.getElementById('demoBar').hidden = !DB.isDemo;
    const store = document.getElementById('storageBtn');
    if (store && !DB.isDemo && session) {
      store.hidden = false;
      store.innerHTML = `${ic('upload', 18)} التخزين`;
      store.onclick = openStorage;
    }
  }

  // ---------------------------------------------------------------- storage
  // Books and pictures live on GitHub (assets/js/storage.js). This screen connects the
  // dashboard once, and moves the files still sitting in Supabase Storage.
  function openStorage() {
    const S = window.GitHubStore;
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.innerHTML = `<h2>${ic('upload', 22)} التخزين على GitHub</h2>
      <p class="muted">الكتب والصور اللي بترفعها من اللوحة بتتحفظ على GitHub، مجانًا ومن غير حد التحميل اللي في Supabase. وبتربطه مرة واحدة بس على كل جهاز.</p>
      <p class="store-status" data-status>جاري التأكد...</p>
      <label class="fld"><span>مفتاح GitHub</span><input type="password" dir="ltr" data-token placeholder="github_pat_..." autocomplete="off" spellcheck="false"></label>
      <div class="modal-acts start"><button class="btn primary" data-save>حفظ وربط</button><button class="btn" data-clear>فك الربط</button></div>
      <details class="store-help"><summary>إزاي أعمل المفتاح؟</summary><ol class="install-steps">
        <li>افتح <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">صفحة المفاتيح على GitHub</a> وانت داخل بحساب <b dir="ltr">${esc(C.files.owner)}</b>.</li>
        <li>في <b>Token name</b> اكتب: لوحة الموقع. وفي <b>Expiration</b> اختار أطول مدة.</li>
        <li>في <b>Repository access</b> اختار <b>Only select repositories</b> وبعدين المستودع <b dir="ltr">${esc(C.files.repo)}</b>.</li>
        <li>في <b>Permissions</b> افتح <b>Repository permissions</b>، وخلي <b>Contents</b> على <b>Read and write</b>.</li>
        <li>اضغط <b>Generate token</b>، وانسخ المفتاح والصقه في الخانة اللي فوق.</li>
      </ol><p class="muted">المفتاح بيتحفظ على الجهاز ده بس، ومحدش غيرك يقدر يشوفه.</p></details>
      <hr class="sep">
      <h3>نقل الملفات القديمة</h3>
      <p class="muted">بينقل الكتب والأغلفة وصور المقالات اللي لسه على Supabase لـ GitHub، ويغيّر روابطها في البوستات. اعمله مرة واحدة بعد الربط، وسيب الصفحة مفتوحة لحد ما يخلص.</p>
      <button class="btn" data-migrate>${ic('upload', 18)} ابدأ النقل</button>
      <pre class="store-log" data-log hidden></pre>
      <div class="modal-acts"><button class="btn" data-close>قفل</button></div>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', () => d.remove());
    const status = d.querySelector('[data-status]');
    const logBox = d.querySelector('[data-log]');
    const refresh = async () => {
      status.textContent = 'جاري التأكد...';
      const r = await S.check();
      status.textContent = r.ok ? `✓ ${r.text}` : r.text;
      status.classList.toggle('ok', r.ok);
      return r.ok;
    };
    refresh();
    d.querySelector('[data-close]').onclick = () => d.close();
    d.querySelector('[data-save]').onclick = async () => {
      const v = d.querySelector('[data-token]').value.trim();
      if (!v) { toast('الصق المفتاح الأول', 'err'); return; }
      S.token.set(v);
      d.querySelector('[data-token]').value = '';
      if (await refresh()) { toast('اتربط التخزين!', 'ok'); if (!location.hash || location.hash === '#/') showList(); }
    };
    d.querySelector('[data-clear]').onclick = () => { S.token.clear(); refresh(); };
    d.querySelector('[data-migrate]').onclick = async e => {
      const btn = e.currentTarget;
      if (!(await refresh())) { toast('اربط التخزين الأول', 'err'); return; }
      btn.disabled = true;
      logBox.hidden = false;
      logBox.textContent = '';
      const log = line => { logBox.textContent += `${line}\n`; logBox.scrollTop = logBox.scrollHeight; };
      try {
        const n = await migrateOld(log);
        log(n ? `✓ خلصنا: اتنقل ${n} ملف.` : 'مفيش ملفات على Supabase. كله على GitHub.');
        toast('خلص النقل', 'ok');
      } catch (err) {
        log(`✗ ${err.message || 'حصلت مشكلة'}. اضغط "ابدأ النقل" تاني، وهيكمل من مكان ما وقف.`);
      }
      btn.disabled = false;
    };
  }

  // Waits until GitHub Pages publishes a new file, so no post points to a missing file.
  async function waitLive(url, log) {
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok) return; } catch (e) {}
      if (i === 2) log('مستني GitHub ينشر الملفات (عادة دقيقة أو اتنين)...');
      await new Promise(r => setTimeout(r, 8000));
    }
    throw new Error('GitHub اتأخر في نشر الملفات');
  }

  // Saves each post as soon as its own files are moved, so a stop half way keeps
  // everything done so far, and pressing the button again carries on from there.
  async function migrateOld(log) {
    const S = window.GitHubStore;
    let moved = 0, lastUrl = '';
    const move = async (url, folder, label) => {
      log(`${label}: جاري النقل...`);
      lastUrl = await S.moveFromSupabase(url, folder, (d, t) => {
        if (t > 3 * 1048576 && d === t) log(`   اترفع ${(t / 1048576).toFixed(1)} ميجا، بيتحفظ على GitHub...`);
      });
      moved++;
      return lastUrl;
    };
    for (const p of await DB.listAll()) {
      const full = await DB.getFull(p.id);
      if (!full) continue;
      let changed = false;
      const name = full.title || 'بدون عنوان';
      if (S.isSupabaseFile(full.cover_url)) { full.cover_url = await move(full.cover_url, 'covers', `غلاف "${name}"`); changed = true; }
      for (const it of full.items || []) {
        if (it.type === 'file' && S.isSupabaseFile(it.value)) {
          it.value = await move(it.value, 'files', `ملف "${it.label || it.fileName || name}"`);
          changed = true;
        } else if (it.type === 'article') {
          const urls = new Set(String(it.value).match(/https:\/\/[^\s)"'\]]+\.supabase\.co\/storage\/v1\/object\/public\/[^\s)"'\]]+/g) || []);
          for (const u of urls) { it.value = it.value.split(u).join(await move(u, 'articles', `صورة في "${name}"`)); changed = true; }
        }
      }
      if (changed) {
        await DB.savePost(full);
        log(`✓ اتنقل "${name}"`);
      }
    }
    if (lastUrl) await waitLive(lastUrl, log);
    return moved;
  }

  // -------------------------------------------------------- installable app
  function setupInstall() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('admin-sw.js', { scope: 'admin.html' }).catch(() => {});
    }
    const btn = document.getElementById('installBtn');
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (standalone || !btn) return; // an old cached admin.html has no button
    btn.innerHTML = `${ic('download', 18)} تثبيت التطبيق`;

    let promptEvent = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      promptEvent = e;
      btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      btn.hidden = true;
      toast('تم تثبيت التطبيق!', 'ok');
    });

    // iPhone and iPad have no install prompt: Safari's share menu is the only way.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) btn.hidden = false;

    btn.onclick = async () => {
      if (promptEvent) {
        promptEvent.prompt();
        await promptEvent.userChoice;
        promptEvent = null;
        btn.hidden = true;
      } else if (ios) {
        const d = document.createElement('dialog');
        d.className = 'modal small';
        d.innerHTML = `<h2>تثبيت التطبيق على الآيفون</h2>
          <ol class="install-steps">
            <li>افتح الصفحة دي من متصفح <b>Safari</b>.</li>
            <li>اضغط زر <b>المشاركة</b> ${ic('share', 18)} في شريط المتصفح.</li>
            <li>اختار <b>Add to Home Screen</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li>
          </ol>
          <div class="modal-acts"><button class="btn primary" data-close>تمام</button></div>`;
        document.body.appendChild(d);
        d.showModal();
        d.addEventListener('close', () => d.remove());
        d.querySelector('[data-close]').onclick = () => d.close();
      }
    };
  }

  async function start() {
    let s = null;
    try { s = await DB.session(); }
    catch { app.innerHTML = '<div class="card empty-state"><h2>تعذر الاتصال بقاعدة البيانات</h2><p>راجع إعدادات config.js.</p></div>'; return; }
    renderTop(s);
    if (!s) return showLogin();
    if (!s.isAdmin) {
      app.innerHTML = `<div class="card empty-state">${ic('lock', 40)}<h2>الحساب ده مش مسجل كمدير</h2><p>نفّذ خطوة إضافة المدير في دليل التشغيل README.md.</p></div>`;
      return;
    }
    route();
  }
  setupInstall();
  start();
})();
