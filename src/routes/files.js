import { createReadStream, createWriteStream } from 'node:fs';
import { stat, readdir, mkdir, rename, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join, resolve, relative, extname, basename, dirname, parse } from 'node:path';
import multipart from '@fastify/multipart';
import { requireAuth } from '../auth.js';

const MEDIA_ROOT = process.env.MEDIA_ROOT;
const SHARE_ROOT = resolve(process.env.SHARE_ROOT || join(MEDIA_ROOT, '_shared'));
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

const MIME_TYPES = {
  '.apk': 'application/vnd.android.package-archive',
  '.ipa': 'application/octet-stream',
  '.zip': 'application/zip',
  '.7z':  'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  '.tar': 'application/x-tar',
  '.gz':  'application/gzip',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md':  'text/markdown; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.dmg': 'application/x-apple-diskimage',
  '.exe': 'application/vnd.microsoft.portable-executable',
};

function mimeFor(name) {
  return MIME_TYPES[extname(name).toLowerCase()] || 'application/octet-stream';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(d) {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

// 사용자 입력 경로를 SHARE_ROOT 안으로 안전하게 해석한다.
function safeResolve(subPath) {
  const cleaned = (subPath || '').replace(/^\/+/, '');
  const abs = resolve(SHARE_ROOT, cleaned);
  const rel = relative(SHARE_ROOT, abs);
  if (rel.startsWith('..') || rel === '..') return null;
  return abs;
}

// 업로드 파일명 정화: 경로 구분자·제어문자·선행 점 제거, 길이 제한
function sanitizeUploadName(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').trim();
  n = n.replace(/^\.+/, '');
  if (!n || n === '.' || n === '..') return null;
  if (n.length > 200) {
    const { name, ext } = parse(n);
    n = name.slice(0, 200 - ext.length) + ext;
  }
  return n;
}

// 동일 이름 있으면 "foo (1).ext" 식으로 빈 슬롯 찾아줌
async function resolveUniquePath(dir, name) {
  const { name: base, ext } = parse(name);
  let candidate = name;
  let n = 1;
  while (true) {
    try {
      await stat(join(dir, candidate));
    } catch {
      return join(dir, candidate);
    }
    candidate = `${base} (${n})${ext}`;
    n++;
    if (n > 9999) throw new Error('too many duplicates');
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderIndex(relDir, entries) {
  const parts = relDir.split('/').filter(Boolean);
  const crumbs = [`<a href="/files/">~</a>`];
  let acc = '';
  for (const p of parts) {
    acc += '/' + encodeURIComponent(p);
    crumbs.push(`<a href="/files${acc}/">${escapeHtml(p)}</a>`);
  }

  const rows = entries.map(e => {
    const encoded = encodeURIComponent(e.name);
    const href = e.isDir
      ? `${encoded}/`
      : `/files/download/${[...parts.map(encodeURIComponent), encoded].join('/')}`;
    const icon = e.isDir ? '📁' : '📄';
    const size = e.isDir ? '—' : formatSize(e.size);
    const mtime = formatDate(e.mtime);
    const attr = e.isDir ? '' : ' download';
    return `<tr>
      <td class="n"><a href="${href}"${attr}>${icon} ${escapeHtml(e.name)}${e.isDir ? '/' : ''}</a></td>
      <td class="s">${size}</td>
      <td class="d">${mtime}</td>
    </tr>`;
  }).join('');

  const parentRow = parts.length > 0
    ? `<tr><td class="n"><a href="../">📁 ..</a></td><td class="s">—</td><td class="d"></td></tr>`
    : '';

  const uploadPath = parts.map(encodeURIComponent).join('/');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Files — Frame NINE</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#111; color:#eee; padding:24px; max-width:1100px; margin:0 auto; }
header { margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid #222; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
header .title { flex:1; }
h1 { font-size:18px; letter-spacing:2px; margin-bottom:8px; }
.crumbs { font-size:13px; color:#888; }
.crumbs a { color:#4ade80; text-decoration:none; margin:0 4px; }
.crumbs a:hover { text-decoration:underline; }
.admin-lock { display:flex; align-items:center; gap:6px; font-size:11px; color:#555; cursor:pointer; padding:4px 10px; border:1px solid #333; border-radius:4px; transition:color 0.15s, border-color 0.15s; }
.admin-lock:hover { color:#aaa; border-color:#555; }
.admin-lock.unlocked { color:#4ade80; border-color:#2a4a2a; }

.upload-zone { display:none; margin-bottom:20px; padding:24px; border:2px dashed #333; border-radius:8px; text-align:center; cursor:pointer; transition:border-color 0.15s, background 0.15s; }
.upload-zone.visible { display:block; }
.upload-zone:hover, .upload-zone.drag { border-color:#4ade80; background:#0f1a0f; }
.upload-zone .hint { font-size:13px; color:#888; margin-bottom:8px; }
.upload-zone .sub { font-size:11px; color:#555; }
.upload-zone input[type=file] { display:none; }

.upload-list { margin-bottom:20px; display:flex; flex-direction:column; gap:6px; }
.upload-item { padding:8px 12px; background:#1a1a1a; border-radius:6px; font-size:12px; }
.upload-item .row { display:flex; justify-content:space-between; gap:10px; margin-bottom:4px; }
.upload-item .name { color:#ddd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.upload-item .pct { color:#888; white-space:nowrap; font-family:monospace; }
.upload-item .bar { height:2px; background:#222; border-radius:2px; overflow:hidden; }
.upload-item .fill { height:100%; background:#4ade80; width:0%; transition:width 0.2s; }
.upload-item.done .fill { background:#4ade80; }
.upload-item.error .fill { background:#f87171; }
.upload-item.error .pct { color:#f87171; }

table { width:100%; border-collapse:collapse; font-size:14px; }
th, td { padding:10px 12px; text-align:left; border-bottom:1px solid #1a1a1a; }
th { font-size:12px; color:#666; font-weight:500; letter-spacing:1px; text-transform:uppercase; }
td.n { min-width:220px; }
td.s { color:#888; white-space:nowrap; width:100px; }
td.d { color:#666; white-space:nowrap; width:160px; font-family:monospace; font-size:12px; }
td.n a { color:#ddd; text-decoration:none; }
td.n a:hover { color:#fff; }
tr:hover td { background:#1a1a1a; }
.empty { padding:40px; text-align:center; color:#555; }
.back { display:inline-block; margin-top:16px; font-size:12px; color:#666; text-decoration:none; }
.back:hover { color:#aaa; }

.modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:100; align-items:center; justify-content:center; }
.modal-overlay.open { display:flex; }
.modal { background:#1a1a1a; border:1px solid #333; border-radius:10px; padding:28px 32px; width:300px; display:flex; flex-direction:column; gap:14px; }
.modal h2 { font-size:15px; color:#eee; }
.modal input[type=password] { padding:8px 12px; background:#111; border:1px solid #333; border-radius:6px; color:#eee; font-size:14px; outline:none; }
.modal input[type=password]:focus { border-color:#555; }
.modal-error { font-size:12px; color:#f87171; min-height:16px; }
.modal-btns { display:flex; gap:8px; justify-content:flex-end; }
.modal-btns button { padding:6px 16px; font-size:13px; border-radius:6px; border:1px solid #333; cursor:pointer; }
.btn-cancel { background:transparent; color:#888; }
.btn-cancel:hover { color:#ccc; }
.btn-confirm { background:#eee; color:#111; border-color:#eee; }
.btn-confirm:hover { background:#fff; }
</style>
</head>
<body>
<header>
  <div class="title">
    <h1>FRAME NINE — FILES</h1>
    <div class="crumbs">${crumbs.join(' / ')}</div>
  </div>
  <div class="admin-lock" id="adminLock">🔒 로그인</div>
</header>

<div class="upload-zone" id="uploadZone">
  <div class="hint">📤 파일을 여기로 드래그하거나 클릭해서 선택</div>
  <div class="sub">최대 5GB / 현재 폴더에 업로드됨</div>
  <input type="file" id="fileInput" multiple />
</div>
<div class="upload-list" id="uploadList"></div>

${entries.length === 0 && parts.length === 0
  ? '<div class="empty">폴더가 비어있습니다.<br><br>로그인 후 위 영역에 파일을 올리면 여기 나타납니다.</div>'
  : `<table>
  <thead><tr><th>이름</th><th>크기</th><th>수정일</th></tr></thead>
  <tbody>${parentRow}${rows}</tbody>
</table>`}
<a href="/" class="back">← Frame NINE 홈</a>

<div class="modal-overlay" id="loginModal">
  <div class="modal">
    <h2>관리자 로그인</h2>
    <input type="password" id="pwInput" placeholder="비밀번호" />
    <div class="modal-error" id="loginError"></div>
    <div class="modal-btns">
      <button class="btn-cancel" id="loginCancel">취소</button>
      <button class="btn-confirm" id="loginConfirm">로그인</button>
    </div>
  </div>
</div>

<script>
(function(){
  const UPLOAD_PATH = ${JSON.stringify(uploadPath)};

  const $lock = document.getElementById('adminLock');
  const $zone = document.getElementById('uploadZone');
  const $input = document.getElementById('fileInput');
  const $list = document.getElementById('uploadList');
  const $modal = document.getElementById('loginModal');
  const $pw = document.getElementById('pwInput');
  const $err = document.getElementById('loginError');
  const $cancel = document.getElementById('loginCancel');
  const $confirm = document.getElementById('loginConfirm');

  let token = localStorage.getItem('adminToken') || null;

  function setUnlocked(on) {
    $lock.textContent = on ? '🔓 로그아웃' : '🔒 로그인';
    $lock.classList.toggle('unlocked', on);
    $zone.classList.toggle('visible', on);
  }

  async function verifyToken() {
    if (!token) { setUnlocked(false); return; }
    try {
      const r = await fetch('/api/transcode/status', { headers: { 'Authorization': 'Bearer ' + token } });
      if (r.status === 401) { token = null; localStorage.removeItem('adminToken'); setUnlocked(false); }
      else setUnlocked(true);
    } catch { setUnlocked(false); }
  }

  $lock.addEventListener('click', () => {
    if (token) {
      token = null;
      localStorage.removeItem('adminToken');
      setUnlocked(false);
      return;
    }
    $pw.value = ''; $err.textContent = '';
    $modal.classList.add('open');
    setTimeout(() => $pw.focus(), 50);
  });
  $cancel.addEventListener('click', () => $modal.classList.remove('open'));

  async function doLogin() {
    const pw = $pw.value;
    if (!pw) return;
    $err.textContent = '';
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const d = await r.json();
      if (!r.ok) { $err.textContent = d.error || '오류'; return; }
      token = d.token;
      localStorage.setItem('adminToken', token);
      $modal.classList.remove('open');
      setUnlocked(true);
    } catch { $err.textContent = '연결 오류'; }
  }
  $confirm.addEventListener('click', doLogin);
  $pw.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  function addItem(name) {
    const el = document.createElement('div');
    el.className = 'upload-item';
    el.innerHTML = '<div class="row"><span class="name"></span><span class="pct">0%</span></div><div class="bar"><div class="fill"></div></div>';
    el.querySelector('.name').textContent = name;
    $list.appendChild(el);
    return {
      setPct(p) { el.querySelector('.pct').textContent = p + '%'; el.querySelector('.fill').style.width = p + '%'; },
      done(msg) { el.classList.add('done'); el.querySelector('.pct').textContent = msg || '완료'; el.querySelector('.fill').style.width = '100%'; },
      fail(msg) { el.classList.add('error'); el.querySelector('.pct').textContent = msg || '실패'; },
    };
  }

  function uploadOne(file) {
    return new Promise((resolve) => {
      const ui = addItem(file.name);
      const form = new FormData();
      form.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/files/upload/' + UPLOAD_PATH);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) ui.setPct(Math.round(e.loaded / e.total * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const d = JSON.parse(xhr.responseText);
            ui.done(d.savedAs && d.savedAs !== file.name ? '완료 (' + d.savedAs + ')' : '완료');
          } catch { ui.done(); }
          resolve(true);
        } else {
          let msg = '실패';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
          ui.fail(msg);
          resolve(false);
        }
      };
      xhr.onerror = () => { ui.fail('연결 오류'); resolve(false); };
      xhr.send(form);
    });
  }

  async function uploadFiles(files) {
    if (!token) { alert('먼저 로그인하세요'); return; }
    const arr = Array.from(files);
    let okCount = 0;
    for (const f of arr) {
      if (await uploadOne(f)) okCount++;
    }
    if (okCount > 0) setTimeout(() => window.location.reload(), 800);
  }

  $zone.addEventListener('click', () => $input.click());
  $input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
    e.target.value = '';
  });
  ['dragenter','dragover'].forEach(ev => $zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); $zone.classList.add('drag');
  }));
  ['dragleave','drop'].forEach(ev => $zone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation(); $zone.classList.remove('drag');
  }));
  $zone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });

  verifyToken();
})();
</script>
</body>
</html>`;
}

export default async function filesRoutes(app) {
  try {
    await mkdir(SHARE_ROOT, { recursive: true });
  } catch (err) {
    app.log.warn({ err }, `[files] SHARE_ROOT 생성 실패: ${SHARE_ROOT}`);
  }

  await app.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 20,
      fields: 5,
    },
  });

  app.log.info(`[files] share root → ${SHARE_ROOT}`);

  app.get('/files', async (req, reply) => reply.redirect('/files/'));

  app.get('/files/*', async (req, reply) => {
    const sub = req.params['*'] || '';
    const abs = safeResolve(sub);
    if (!abs) return reply.code(400).send({ error: 'invalid path' });

    let st;
    try {
      st = await stat(abs);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }

    if (st.isFile()) return streamFile(reply, abs);
    if (!st.isDirectory()) return reply.code(404).send({ error: 'not found' });
    if (!req.url.endsWith('/')) return reply.redirect(req.url + '/');

    const rawEntries = await readdir(abs, { withFileTypes: true });
    const entries = [];
    for (const e of rawEntries) {
      if (e.name.startsWith('.')) continue;
      const full = join(abs, e.name);
      try {
        const s = await stat(full);
        entries.push({ name: e.name, isDir: s.isDirectory(), size: s.size, mtime: s.mtime });
      } catch {}
    }
    entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, 'ko');
    });

    reply.type('text/html; charset=utf-8');
    return renderIndex(sub.replace(/\/$/, ''), entries);
  });

  app.get('/files/download/*', async (req, reply) => {
    const sub = req.params['*'] || '';
    const abs = safeResolve(sub);
    if (!abs) return reply.code(400).send({ error: 'invalid path' });

    let st;
    try {
      st = await stat(abs);
    } catch {
      return reply.code(404).send({ error: 'not found' });
    }
    if (!st.isFile()) return reply.code(404).send({ error: 'not found' });
    return streamFile(reply, abs);
  });

  // 업로드: 인증 필요
  app.post('/files/upload/*', { preHandler: requireAuth }, async (req, reply) => {
    const sub = req.params['*'] || '';
    const targetDir = safeResolve(sub);
    if (!targetDir) return reply.code(400).send({ error: '잘못된 경로' });

    // 대상 디렉토리 존재 확인 (반드시 기존 디렉토리여야 함)
    try {
      const st = await stat(targetDir);
      if (!st.isDirectory()) return reply.code(400).send({ error: '디렉토리가 아님' });
    } catch {
      return reply.code(404).send({ error: '디렉토리 없음' });
    }

    const part = await req.file();
    if (!part) return reply.code(400).send({ error: '파일 없음' });

    const safeName = sanitizeUploadName(part.filename);
    if (!safeName) return reply.code(400).send({ error: '잘못된 파일명' });

    const finalPath = await resolveUniquePath(targetDir, safeName);
    const tmpPath = finalPath + '.part';

    try {
      await pipeline(part.file, createWriteStream(tmpPath));
    } catch (err) {
      try { await unlink(tmpPath); } catch {}
      app.log.error(err, '[files] upload stream error');
      return reply.code(500).send({ error: '업로드 실패' });
    }

    // 용량 초과 시 multipart가 truncated 플래그를 세운다
    if (part.file.truncated) {
      try { await unlink(tmpPath); } catch {}
      return reply.code(413).send({ error: '파일이 너무 큼 (최대 5GB)' });
    }

    await rename(tmpPath, finalPath);

    const savedAs = basename(finalPath);
    app.log.info(`[files] 업로드: ${relative(SHARE_ROOT, finalPath)}`);
    return { ok: true, savedAs };
  });
}

function streamFile(reply, abs) {
  const name = basename(abs);
  reply.header('Content-Type', mimeFor(name));
  reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  reply.header('Cache-Control', 'no-cache');
  return reply.send(createReadStream(abs));
}
