// Site settings. The two Supabase values and the Google client ID are public by design:
// they are protected by the database rules in supabase/setup.sql.
// While supabaseUrl is empty the site runs in demo mode (data stays in this browser only).
window.SITE_CONFIG = {
  siteName: 'أبو حنين القناص',
  tagline: 'كل المحتوى الحصري في مكان واحد',
  defaultChannel: '@Abu-Hanin',

  supabaseUrl: 'https://jyrcywuxqfandzerlrga.supabase.co',
  supabaseAnonKey: 'sb_publishable_4tt3LWss6QhyskTBnM7aCA_Aq4kw1c8',
  googleClientId: '',

  // Seconds a step stays on "جاري التحقق" after its button is pressed, then it completes.
  checkSeconds: 15,

  // Where the dashboard keeps books and pictures: a GitHub repository published by GitHub Pages.
  files: { owner: 'walid-salama', repo: 'files', branch: 'main', base: 'https://walid-salama.github.io/files' },

  bio: 'منشئ محتوى فيديو. كتب وأدوات وبرومبتات مجانية، تفتحها بخطوة واحدة.',
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
