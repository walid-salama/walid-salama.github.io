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
  const media = p => {
    const img = window.safeImg(p.cover_url);
    return img ? `<div class="pc-media">
        <img class="pc-blur" src="${esc(img)}" alt="" aria-hidden="true" loading="lazy">
        <img class="pc-img" src="${esc(img)}" alt="" loading="lazy">
        <span class="pc-badge">${ic('lock', 14)} مجاني</span></div>` : '';
  };
  const meta = p => `<div class="post-meta">
      ${p.created_at ? `<span>${ic('clock', 15)} ${window.fmtDate(p.created_at)}</span>` : ''}
      <span>${ic('eye', 15)} ${window.fmtNum(p.views)} مشاهدة</span>
      <span>${ic('unlock', 15)} ${window.fmtNum(p.unlocks)} فتح</span></div>`;

  const card = p => `<a class="post-card ${window.safeImg(p.cover_url) ? '' : 'no-img'}" href="${href(p)}">
      ${media(p)}
      <div class="post-body">
        <h3 dir="auto">${esc(p.title)}</h3>
        ${meta(p)}
        <span class="post-cta">افتح المحتوى ${ic('arrow', 16)}</span>
      </div></a>`;

  const featured = p => `<a class="featured" href="${href(p)}">
      ${media(p)}
      <div class="featured-body">
        <span class="featured-tag">الأحدث</span>
        <h3 dir="auto">${esc(p.title)}</h3>
        ${meta(p)}
        <span class="btn primary featured-cta">${ic('unlock', 18)} افتح المحتوى مجانًا</span>
      </div></a>`;

  function show(list, searching) {
    $('count').textContent = `(${list.length})`;
    if (!list.length) {
      $('featured').innerHTML = '';
      grid.innerHTML = `<p class="muted center">مفيش نتايج. جرّب كلمة تانية.</p>`;
      return;
    }
    const top = searching ? null : list[0];
    $('featured').innerHTML = top ? featured(top) : '';
    grid.innerHTML = (top ? list.slice(1) : list).map(card).join('');
  }

  show(posts, false);
  if (posts.length > 3) {
    $('searchBox').hidden = false;
    $('search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      show(q ? posts.filter(p => String(p.title).toLowerCase().includes(q)) : posts, !!q);
    });
  }
})();
