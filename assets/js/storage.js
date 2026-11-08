// Dashboard only: keeps books and pictures on GitHub (the files/ folder of the site's
// repository, published by GitHub Pages) instead of Supabase Storage, whose free plan allows only 5 GB of downloads a
// month. The owner connects once with a GitHub key kept in this browser only.
(function () {
  const C = window.SITE_CONFIG;
  const R = C.files;
  const API = `https://api.github.com/repos/${R.owner}/${R.repo}`;
  const KEY = 'miftah_gh_token';
  const MAX_BYTES = 95 * 1024 * 1024; // GitHub refuses single files over 100 MB.

  const token = {
    get() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
    set(v) { try { localStorage.setItem(KEY, v.trim()); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };

  // One GitHub API call. Uses XMLHttpRequest so a large upload can report its progress.
  function gh(method, path, body, onProgress) {
    return new Promise((res, rej) => {
      const xhr = new XMLHttpRequest();
      // GitHub lets browsers keep its answers for a minute. A stale branch tip makes the
      // next commit fail, so every read asks for a fresh copy.
      const fresh = method === 'GET' ? `${path.includes('?') ? '&' : '?'}_=${Date.now()}` : '';
      xhr.open(method, API + path + fresh);
      xhr.setRequestHeader('Authorization', `Bearer ${token.get()}`);
      xhr.setRequestHeader('Accept', 'application/vnd.github+json');
      if (body) xhr.setRequestHeader('Content-Type', 'application/json');
      if (onProgress) xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText || 'null'); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300) res(data);
        else { const err = new Error(`github_${xhr.status}`); err.status = xhr.status; rej(err); }
      };
      xhr.onerror = () => rej(new Error('network'));
      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  const base64Of = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(new Error('read'));
    r.readAsDataURL(file);
  });

  // Adds one file to the repository as a new commit. Two uploads at the same moment can
  // race for the branch, so it retries from the latest state.
  async function commitFile(path, blobSha) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const ref = await gh('GET', `/git/ref/heads/${R.branch}`);
        const parent = await gh('GET', `/git/commits/${ref.object.sha}`);
        const tree = await gh('POST', '/git/trees', {
          base_tree: parent.tree.sha,
          tree: [{ path, mode: '100644', type: 'blob', sha: blobSha }],
        });
        const commit = await gh('POST', '/git/commits', { message: `Add ${path}`, tree: tree.sha, parents: [ref.object.sha] });
        await gh('PATCH', `/git/refs/heads/${R.branch}`, { sha: commit.sha });
        return;
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
        await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
      }
    }
    throw new Error('github_busy');
  }

  function friendly(e) {
    if (e.status === 401) return 'مفتاح GitHub غير صحيح أو انتهت صلاحيته. اربطه تاني من زرار "التخزين".';
    if (e.status === 403 || e.status === 404) return 'المفتاح مالوش صلاحية الكتابة على مستودع الموقع. راجع خطوات الربط.';
    if (e.message === 'network') return 'انقطع الاتصال أثناء الرفع. حاول تاني.';
    return 'تعذر رفع الملف على GitHub. حاول تاني.';
  }

  async function upload(file, folder, onProgress) {
    if (!token.get()) throw new Error('اربط التخزين على GitHub الأول من زرار "التخزين" اللي فوق.');
    if (file.size > MAX_BYTES) throw new Error('الحد الأقصى لحجم الملف 95 ميجا.');
    const ext = (file.name.match(/\.[a-z0-9]{1,8}$/i) || [''])[0].toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${R.dir ? `${R.dir}/` : ''}${folder}/${Date.now().toString(36)}-${rand}${ext}`;
    try {
      const content = await base64Of(file);
      // The encoded file is about a third larger than the file, so progress follows the request.
      const blob = await gh('POST', '/git/blobs', { content, encoding: 'base64' },
        onProgress ? (d, t) => onProgress(Math.min(file.size, Math.round((d / t) * file.size)), file.size) : null);
      await commitFile(path, blob.sha);
    } catch (e) {
      throw new Error(e.status || e.message === 'network' ? friendly(e) : (e.message || friendly(e)));
    }
    return `${R.base}/${path}`;
  }

  // Checks the key: it must reach the repository and be allowed to write to it.
  async function check() {
    if (!token.get()) return { ok: false, text: 'مش مربوط' };
    try {
      const repo = await gh('GET', '');
      if (!repo.permissions || !repo.permissions.push) return { ok: false, text: 'المفتاح شغال بس مالوش صلاحية الكتابة على المستودع.' };
      return { ok: true, text: `مربوط بـ ${repo.full_name}` };
    } catch (e) {
      return { ok: false, text: friendly(e) };
    }
  }

  // Shrinks a picture before upload: big phone photos become a fraction of their size,
  // which is what visitors download every time they open a page.
  async function compressImage(file, maxSide) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
    const limit = maxSide || 1600;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const scale = Math.min(1, limit / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d');
      g.fillStyle = '#0d0f12'; // pictures with see-through parts get the site's background
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      const out = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
      if (!out || out.size >= file.size) return file;
      return new File([out], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) {
      return file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const isSupabaseFile = url => /\.supabase\.co\/storage\/v1\/object\/public\//i.test(String(url || ''));

  // Moves a file that is still in Supabase Storage to GitHub, and returns its new address.
  async function moveFromSupabase(url, folder, onProgress) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('تعذر قراءة الملف القديم.');
    const blob = await res.blob();
    const name = decodeURIComponent(url.split('?')[0].split('/').pop() || 'file');
    let file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
    if (file.type.startsWith('image/')) file = await compressImage(file);
    return upload(file, folder, onProgress);
  }

  window.GitHubStore = { token, check, upload, compressImage, isSupabaseFile, moveFromSupabase, ready: () => !!token.get() };
})();
