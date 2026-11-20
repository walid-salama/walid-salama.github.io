// Site settings. The two Supabase values and the Google client ID are public by design:
// they are protected by the database rules in supabase/setup.sql.
// While supabaseUrl is empty the site runs in demo mode (data stays in this browser only).
window.SITE_CONFIG = {
  siteName: 'أبو حنين القناص',
  tagline: 'متجر كتب PDF: كتب مجانية وكتب مدفوعة',
  defaultChannel: '@Abu-Hanin',

  // Project "miftah2" in the "walid-salama" organization (moved 2026-11-08: the first
  // project's organization went over the free download quota).
  supabaseUrl: 'https://hhqxhdgylnjxkqqcowxk.supabase.co',
  supabaseAnonKey: 'sb_publishable_3-Tu5PJFN7GGG8uNZmCiXw_deTsgfgh',
  googleClientId: '',

  // Seconds a step stays on "جاري التحقق" after its button is pressed, then it completes.
  checkSeconds: 15,

  // Where the dashboard keeps books and pictures: the "files" folder of this site's own
  // repository, published by GitHub Pages. Cloudflare skips that folder (its build command
  // removes it), since it refuses files over 25 MB.
  files: { owner: 'walid-salama', repo: 'walid-salama.github.io', branch: 'main', dir: 'files', base: 'https://walid-salama.github.io' },

  // Books FOR SALE: a PRIVATE repository, so a paid book can't be downloaded without paying.
  // Only the server (supabase/functions/store-download) hands a buyer a link that works for minutes.
  paidFiles: { owner: 'walid-salama', repo: 'paid-books', branch: 'main', dir: 'files' },

  // Paid books through Kashier (Visa / Mastercard). The keys live on the server only
  // (Supabase > Edge Functions > Secrets), never here.
  store: {
    currency: 'ج.م',
    // Each order downloads ONCE on one device (supabase/functions/store-download).
    downloadGraceMinutes: 15,
    gateway: 'Kashier',
  },

  // Shown on the policy pages and in the footer. Payment gateways ask for real details.
  legal: {
    businessName: 'أبو حنين القناص',
    owner: 'وليد سلامة',
    email: 'mouugfwr@gmail.com',
    phone: '01154846407',
    whatsapp: '',
    address: 'جمهورية مصر العربية',
    updated: '2026-11-20',
  },

  bio: 'متجر كتب PDF في كل المجالات: كتب مجانية تفتحها بخطوة واحدة، وكتب مدفوعة تشتريها بالفيزا أو الماستركارد وتحمّلها فورًا.',
  // Shown on the home page. p picks the icon and color from PLATFORMS in actions.js.
  socials: [
    { p: 'youtube', label: 'هدفنا الفلوس', sub: 'قناة يوتيوب', url: 'https://www.youtube.com/channel/UCV261ZxSoBwUMZ5cKd_LjyQ' },
    { p: 'youtube', label: 'أبو حنين القناص', sub: 'قناة يوتيوب', url: 'https://www.youtube.com/@abu-hanin1' },
    { p: 'facebook', label: 'صفحة أبو حنين القناص', sub: 'فيسبوك', url: 'https://www.facebook.com/share/1DVQV1HWkG/' },
    { p: 'tiktok', label: 'أبو حنين على تيك توك', sub: 'تيك توك', url: 'https://www.tiktok.com/@abu_hanin11' },
    { p: 'telegram', label: 'قناة التليجرام', sub: 'تليجرام', url: 'https://t.me/Abu_Hanin1' },
  ],
  contacts: [
    { p: 'facebook', label: 'للدعاية والإعلان', url: 'https://www.facebook.com/share/1DVQV1HWkG/' },
    { p: 'telegram', label: 'للتواصل على تليجرام', url: 'https://t.me/walidsalama' },
  ],
};

// Two routes to the data, so a network that blocks one still gets through the other:
// the database directly, and the same database through the Cloudflare address (functions/sb).
(function (C) {
  const host = location.hostname;
  const proxy = 'https://abu-hanin.pages.dev/sb';
  if (/^localhost$|^127\./.test(host)) { C.apiRoutes = [C.supabaseUrl]; }
  else if (/(^|\.)github\.io$/.test(host)) { C.apiRoutes = [C.supabaseUrl, proxy]; }
  else { C.apiRoutes = [`${location.origin}/sb`, C.supabaseUrl]; }
  C.apiBase = C.apiRoutes[0];
})(window.SITE_CONFIG);
