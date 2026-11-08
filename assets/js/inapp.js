// Messenger, Facebook and Instagram open links in their own browser, which isn't signed in to
// Google, so YouTube asks for a login. This sends visitors to Chrome instead.
// On Android the jump is tried right away. The app can ignore a jump the visitor didn't tap
// for, so a small bar stays available. On iPhone only a tap can do it.
(function () {
  const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBLITE|Orca|Messenger|Instagram/i;
  const TRIED = 'miftah_tried_chrome';

  const InApp = {
    // Returns 'android' or 'ios' inside one of those apps, otherwise null.
    detect(ua) {
      if (!IN_APP.test(ua)) return null;
      if (/android/i.test(ua)) return 'android';
      return /iphone|ipad|ipod/i.test(ua) ? 'ios' : null;
    },

    // counted: this visit was already counted here, so Chrome must not count it again.
    chromeUrl(href, platform, counted) {
      const u = new URL(href);
      if (counted) u.searchParams.set('counted', '1');
      const rest = u.host + u.pathname + u.search;
      if (platform === 'ios') return `googlechromes://${rest}`;
      // Without Chrome installed, Android comes back here marked so the page carries on normally.
      const fallback = new URL(href);
      fallback.searchParams.set('nochrome', '1');
      return `intent://${rest}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
    },

    // Opens a YouTube link in the YouTube app, where the visitor is already signed in.
    // Android falls back to the web page by itself; iPhone needs a moment to tell.
    openYouTube(url) {
      const ua = navigator.userAgent;
      const u = new URL(url);
      const rest = u.host + u.pathname + u.search;
      if (/android/i.test(ua)) {
        location.href = `intent://${rest}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(url)};end`;
        return;
      }
      if (/iphone|ipad|ipod/i.test(ua)) {
        location.href = `youtube://${rest}`;
        setTimeout(() => { if (!document.hidden) location.href = url; }, 1500);
        return;
      }
      const w = window.open(url, '_blank');
      if (w) { try { w.opener = null; } catch (e) {} } else location.href = url;
    },

    open(platform, counted) {
      location.href = InApp.chromeUrl(location.href, platform, counted);
    },

    // Tried once per visit, on Android. Returns true if it was tried just now.
    autoOpen(platform) {
      if (platform !== 'android') return false;
      try {
        if (sessionStorage.getItem(TRIED)) return false;
        sessionStorage.setItem(TRIED, '1');
      } catch (e) { return false; }
      InApp.open(platform, false);
      return true;
    },
  };

  if (typeof window !== 'undefined') window.InApp = InApp;
  if (typeof module !== 'undefined') module.exports = InApp;
})();
