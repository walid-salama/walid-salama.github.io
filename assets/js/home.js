// Public home page: the author, their accounts, and the posts marked "public".
(async function () {
  window.PAGE_STARTED = true;
  const C = window.SITE_CONFIG;
  const ic = window.uiIcon;
  const esc = window.esc;
  const $ = id => document.getElementById(id);

  // ------------------------------------------------------------- accounts
  // Drawn before loading posts, so they show even when the posts can't load.
  const brand = p => window.PLATFORMS[p] || window.PLATFORMS.web;
  const link = (s, cls, withText) => {
    const b = brand(s.p);
    return `<a class="${cls}" href="${esc(window.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer"
      style="--brand:${b.color};--brand-fg:${b.fg}" aria-label="${esc(s.label)}"><i class="soc-ic">${window.brandIcon(s.p, 20)}</i>
      ${withText ? `<span><b dir="auto">${esc(s.label)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>` : ''}</a>`;
  };
  const socials = C.socials || [];
  const contacts = C.contacts || [];
  $('bio').textContent = C.bio || '';
  $('footBio').textContent = C.bio || '';
  $('topSocial').innerHTML = socials.map(s => link(s, 'soc-round', false)).join('');
  $('authorSocial').innerHTML = socials.map(s => link(s, 'soc-pill', true)).join('');
  // Footer: icons only, side by side. The name shows on hover and is read out by screen readers.
  const iconLink = s => link(s, 'soc-big', false).replace('<a ', `<a title="${esc(s.label)}" `);
  $('footSocial').innerHTML = socials.map(iconLink).join('');
  $('footContact').innerHTML = contacts.map(iconLink).join('');
  $('copy').textContent = `© ${new Date().getFullYear()} ${C.siteName}. كل الحقوق محفوظة.`;
  if ($('footPay')) $('footPay').innerHTML = `${window.payLogos()}<span>الدفع الآمن عن طريق Kashier: كروت، محافظ إلكترونية، إنستاباي، تقسيط</span>`;

  // --------------------------------------------------------------- posts
  const grid = $('grid');
  let posts = [];
  try { posts = await window.DB.listPublic(); }
  catch (e) {
    grid.innerHTML = '<div class="empty-state"><h2>تعذر الاتصال بالموقع</h2><p>تأكد من الإنترنت وحاول تاني.</p><a class="btn primary" href="">حاول تاني</a></div>';
    return;
  }
  if (!posts.length) {
    grid.innerHTML = `<div class="empty-state">${ic('gift', 44)}<h2>المحتوى قادم قريبًا</h2></div>`;
    return;
  }

  const href = p => `/${encodeURIComponent(p.slug)}`;
  // The blurred copy fills the frame, so a picture of any shape shows whole with no empty bars.
  // A book for sale shows as a real book with its price; free content keeps its picture.
  const media = p => {
    const img = window.safeImg(p.cover_url);
    if (p.paid) {
      return `<div class="pc-media pc-book">
        ${img ? `<img class="pc-blur" src="${esc(img)}" alt="" aria-hidden="true" loading="lazy">` : ''}
        ${window.book3d(img)}
        <span class="pc-badge paid">${esc(window.fmtPrice(p.price))}</span></div>`;
    }
    return img ? `<div class="pc-media">
        <img class="pc-blur" src="${esc(img)}" alt="" aria-hidden="true" loading="lazy">
        <img class="pc-img" src="${esc(img)}" alt="" loading="lazy">
        <span class="pc-badge">${ic('lock', 14)} مجاني</span></div>` : '';
  };
  const meta = p => `<div class="post-meta">
      ${p.paid && Number(p.pages) > 0 ? `<span>${ic('article', 15)} ${Number(p.pages).toLocaleString('en')} صفحة</span>` : ''}
      ${!p.paid && p.created_at ? `<span>${ic('clock', 15)} ${window.fmtDate(p.created_at)}</span>` : ''}
      <span>${ic('eye', 15)} ${window.fmtNum(p.views)} مشاهدة</span>
      <span>${ic(p.paid ? 'download' : 'unlock', 15)} ${window.fmtNum(p.unlocks)} ${p.paid ? 'تحميل' : 'فتح'}</span></div>`;
  const cta = p => (p.paid
    ? `<span class="post-cta buy">${ic('lock', 16)} اشترِ الآن <b>${esc(window.fmtPrice(p.price))}</b></span>`
    : `<span class="post-cta">افتح المحتوى ${ic('arrow', 16)}</span>`);

  const card = p => `<a class="post-card ${p.paid ? 'is-paid' : ''} ${window.safeImg(p.cover_url) || p.paid ? '' : 'no-img'}" href="${href(p)}">
      ${media(p)}
      <div class="post-body">
        <h3 dir="auto">${esc(p.title)}</h3>
        ${meta(p)}
        ${cta(p)}
      </div></a>`;

  const featured = p => `<a class="featured ${p.paid ? 'is-paid' : ''}" href="${href(p)}">
      ${media(p)}
      <div class="featured-body">
        <span class="featured-tag">${p.paid ? 'كتاب مميز' : 'الأحدث'}</span>
        <h3 dir="auto">${esc(p.title)}</h3>
        ${meta(p)}
        ${p.paid
          ? `<span class="btn primary featured-cta buy">${ic('lock', 18)} اشترِ الآن · ${esc(window.fmtPrice(p.price))}</span>`
          : `<span class="btn primary featured-cta">${ic('unlock', 18)} افتح المحتوى مجانًا</span>`}
      </div></a>`;

  // Most viewed, beside the newest post.
  const popular = posts.length > 3 ? posts.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 4) : [];
  if (popular.length) {
    $('popularList').innerHTML = popular.map((p, i) => {
      const img = window.safeImg(p.cover_url);
      return `<li><a href="${href(p)}"><b class="rank">${i + 1}</b>
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}
        <span><strong dir="auto">${esc(p.title)}</strong><small>${ic('eye', 13)} ${window.fmtNum(p.views)} مشاهدة</small></span></a></li>`;
    }).join('');
  }

  const PAGE = 9;
  let shown = PAGE;
  let current = posts;

  function show(list, searching) {
    current = list;
    $('count').textContent = `(${list.length})`;
    $('popular').hidden = searching || !popular.length;
    document.querySelector('.top-row').classList.toggle('has-popular', !searching && !!popular.length);
    if (!list.length) {
      $('featured').innerHTML = '';
      $('more').hidden = true;
      grid.innerHTML = `<p class="muted center">مفيش نتايج. جرّب كلمة تانية.</p>`;
      return;
    }
    const top = searching ? null : list[0];
    $('featured').innerHTML = top ? featured(top) : '';
    const rest = top ? list.slice(1) : list;
    grid.innerHTML = rest.slice(0, shown).map(card).join('');
    $('more').hidden = rest.length <= shown;
    revealCards();
  }

  $('more').addEventListener('click', () => { shown += PAGE; show(current, !!$('search').value.trim()); });

  // ------------------------------------------------------------------ 3D
  // Cards rise into place as they come into view, and tilt toward the mouse on computers.
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let watched = false;
  const io = !calm && window.IntersectionObserver
    ? new IntersectionObserver(entries => entries.forEach(en => {
      watched = true;
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  // Safety net: if the browser never reports what's on screen, nothing may stay hidden.
  setTimeout(() => {
    if (!watched) document.querySelectorAll('.post-card, .featured').forEach(el => el.classList.add('in'));
  }, 2000);
  function revealCards() {
    document.querySelectorAll('.post-card:not(.in), .featured:not(.in)').forEach((el, i) => {
      if (!io) { el.classList.add('in'); return; }
      el.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
      io.observe(el);
    });
  }
  if (!calm && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest && e.target.closest('.post-card, .featured');
      document.querySelectorAll('.tilting').forEach(t => { if (t !== el) { t.classList.remove('tilting'); t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); } });
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const strength = el.classList.contains('featured') ? 4 : 8;
      el.classList.add('tilting');
      el.style.setProperty('--ry', `${(x - 0.5) * strength}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * strength}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
  }

  // Books for sale tilt toward the mouse (a tap still opens them).
  window.bookSpin(document.querySelector('.feed'));

  // Search and the free / paid tabs work together.
  let kind = 'all';
  const apply = () => {
    const q = $('search').value.trim().toLowerCase();
    const list = posts.filter(p => (kind === 'all' || (kind === 'paid') === !!p.paid)
      && (!q || String(p.title).toLowerCase().includes(q)));
    shown = PAGE;
    show(list, !!q || kind !== 'all');
  };
  show(posts, false);
  if (posts.length > 3) {
    $('searchBox').hidden = false;
    $('search').addEventListener('input', apply);
  }
  if (posts.some(p => p.paid) && posts.some(p => !p.paid)) {
    $('kindFilter').hidden = false;
    $('kindFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-kind]');
      if (!b) return;
      kind = b.dataset.kind;
      $('kindFilter').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      apply();
    });
  }
})();
