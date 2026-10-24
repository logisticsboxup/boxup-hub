// BoxUp Logistics Hub: main process (window, sign-in, data, downloads, updates)
const { app, BrowserWindow, ipcMain, session, shell, dialog, Notification, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

const PARTITION = 'persist:boxup';
const LOG_URL = 'https://script.google.com/macros/s/AKfycbxkWlpzmubWJwgFQF7cCDAegDHDFpst-j2AnoLVrk3rVnZL9CuOukEIC_GR43gUlL7e/exec';
const UPDATE_FEED = 'https://logisticsboxup.github.io/boxup-hub/';
const ALLOWED_EMAIL = 'logisticsboxup@gmail.com';
const CHROME_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

app.setName('BoxUp Logistics Hub');
app.userAgentFallback = CHROME_UA;
if (!app.requestSingleInstanceLock()) { app.quit(); }

const USER = () => app.getPath('userData');
const SETTINGS_FILE = () => path.join(USER(), 'settings.json');
const LOG_FILE = () => path.join(USER(), 'activity.json');
const UI_DIR = () => path.join(USER(), 'ui-versions');
const BUNDLED_UI = path.join(__dirname, 'ui');

/* ---------------- settings ---------------- */
function readJson(file, dflt) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return dflt; } }
function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
let settings = null;
function getSettings() { if (!settings) settings = readJson(SETTINGS_FILE(), {}); return settings; }
function saveSettings(patch) { settings = Object.assign(getSettings(), patch || {}); writeJson(SETTINGS_FILE(), settings); return settings; }
function logEvent(app_, what) {
  const list = readJson(LOG_FILE(), []);
  list.unshift({ at: Date.now(), app: app_, what });
  writeJson(LOG_FILE(), list.slice(0, 500));
}

/* ---------------- which UI version to load ---------------- */
function bundledVersion() { return readJson(path.join(BUNDLED_UI, 'version.json'), { version: '1.0.0' }).version; }
function cmpVer(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
function activeUi() {
  const s = getSettings();
  const v = s.uiVersion;
  if (v && cmpVer(v, bundledVersion()) > 0 && fs.existsSync(path.join(UI_DIR(), v, 'index.html'))) return { dir: path.join(UI_DIR(), v), version: v };
  return { dir: BUNDLED_UI, version: bundledVersion() };
}

/* ---------------- window ---------------- */
let win = null;
function createWindow() {
  const ui = activeUi();
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640,
    title: 'BoxUp Logistics Hub', backgroundColor: '#0b281c', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), webviewTag: true, contextIsolation: true, nodeIntegration: false, partition: PARTITION }
  });
  win.removeMenu();
  win.loadFile(path.join(ui.dir, 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('closed', () => { win = null; });
}
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

/* ---------------- session: user agent, permissions, downloads, popups ---------------- */
function setupSession() {
  const ses = session.fromPartition(PARTITION);
  ses.setUserAgent(CHROME_UA);
  ses.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'mediaKeySystem'].includes(permission));
  });
  ses.on('will-download', (e, item) => {
    const dir = path.join(app.getPath('downloads'), 'BoxUp');
    fs.mkdirSync(dir, { recursive: true });
    let name = item.getFilename(), target = path.join(dir, name), n = 1;
    while (fs.existsSync(target)) { const ext = path.extname(name); target = path.join(dir, `${path.basename(name, ext)} (${n++})${ext}`); }
    item.setSavePath(target);
    item.once('done', (ev, state) => {
      if (state !== 'completed') { send('download', { ok: false, name }); return; }
      logEvent('Download', 'Saved ' + path.basename(target));
      const after = getSettings().afterDownload || 'show';
      if (after === 'open') shell.openPath(target);
      send('download', { ok: true, name: path.basename(target), path: target, after });
    });
  });
}

app.on('web-contents-created', (e, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i.test(url)) { send('open-whatsapp', url); return { action: 'deny' }; }
    if (/^https?:/i.test(url) && wc.getType() === 'webview') { send('open-url', url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { partition: PARTITION } } };
  });
});

/* ---------------- Google sign-in ---------------- */
async function googleAccounts() {
  try {
    const ses = session.fromPartition(PARTITION);
    const r = await ses.fetch('https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser&json=standard', { method: 'POST' });
    const t = await r.text();
    const emails = [...new Set((t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(s => s.toLowerCase()))];
    let name = '';
    try { const j = JSON.parse(t); const acc = (j[1] || []).find(a => String(a[3]).toLowerCase() === ALLOWED_EMAIL); if (acc) name = acc[2] || ''; } catch (err) {}
    return { emails, name };
  } catch (err) { return { emails: [], name: '', error: String(err) }; }
}
async function authStatus() {
  const { emails, name, error } = await googleAccounts();
  const ok = emails.includes(ALLOWED_EMAIL);
  return { ok, email: ok ? ALLOWED_EMAIL : (emails[0] || ''), name: name || 'Logistics', others: emails, error, allowed: ALLOWED_EMAIL };
}
function signIn() {
  return new Promise(resolve => {
    const w = new BrowserWindow({ width: 520, height: 700, parent: win, modal: true, title: 'Sign in with Google', autoHideMenuBar: true, webPreferences: { partition: PARTITION } });
    w.removeMenu();
    let finished = false;
    const done = async () => { if (finished) return; finished = true; const s = await authStatus(); if (!w.isDestroyed()) w.close(); if (s.ok) logEvent('Sign in', 'Signed in as ' + s.email); resolve(s); };
    w.webContents.on('did-navigate', (ev, url) => { if (/^https:\/\/myaccount\.google\.com/.test(url)) done(); });
    w.on('closed', async () => { if (!finished) { finished = true; resolve(await authStatus()); } });
    w.loadURL('https://accounts.google.com/ServiceLogin?hl=en&continue=' + encodeURIComponent('https://myaccount.google.com/') + '&Email=' + encodeURIComponent(ALLOWED_EMAIL));
  });
}
async function signOut() {
  const ses = session.fromPartition(PARTITION);
  const cookies = await ses.cookies.get({});
  for (const c of cookies) {
    if (/google\.com$|youtube\.com$|googleusercontent\.com$/.test(c.domain.replace(/^\./, ''))) {
      const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
      try { await ses.cookies.remove(url, c.name); } catch (e) {}
    }
  }
  logEvent('Sign in', 'Signed out');
  return { ok: true };
}

/* ---------------- Label Log data (Apps Script) ---------------- */
async function getJson(url, timeoutMs) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs || 60000);
  try { const r = await net.fetch(url, { signal: ctl.signal }); return JSON.parse(await r.text()); }
  finally { clearTimeout(t); }
}

/* ---------------- updates (new screens downloaded from GitHub) ---------------- */
let pending = null;
async function checkUpdate() {
  const cur = activeUi().version;
  try {
    const feed = await getJson(UPDATE_FEED + 'latest.json?t=' + Date.now(), 20000);
    saveSettings({ lastUpdateCheck: Date.now() });
    if (feed && feed.version && cmpVer(feed.version, cur) > 0) { pending = feed; return { available: true, current: cur, latest: feed }; }
    return { available: false, current: cur, latest: feed || null };
  } catch (err) {
    saveSettings({ lastUpdateCheck: Date.now() });
    return { available: false, current: cur, error: 'Could not reach the update server' };
  }
}
async function installUpdate() {
  if (!pending) { const c = await checkUpdate(); if (!c.available) return { ok: false, error: 'No update to install' }; }
  const feed = pending, dir = path.join(UI_DIR(), feed.version), tmp = dir + '.part';
  fs.rmSync(tmp, { recursive: true, force: true });
  const files = feed.files || [];
  let got = 0;
  for (const f of files) {
    const r = await net.fetch(UPDATE_FEED + 'ui/' + f.path.split('/').map(encodeURIComponent).join('/') + '?v=' + feed.version);
    if (!r.ok) return { ok: false, error: 'Download failed: ' + f.path };
    const buf = Buffer.from(await r.arrayBuffer());
    send('update-progress', { step: 'download', done: ++got, total: files.length });
    if (f.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== f.sha256) return { ok: false, error: 'File check failed: ' + f.path };
    const out = path.join(tmp, f.path); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, buf);
  }
  send('update-progress', { step: 'verified' });
  fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
  const prev = activeUi().version;
  const hist = getSettings().updateHistory || [];
  hist.unshift({ version: feed.version, date: Date.now(), notes: (feed.notes || []).map(n => n.title || n).join(', ') });
  saveSettings({ uiVersion: feed.version, previousUiVersion: prev, updateHistory: hist.slice(0, 30) });
  logEvent('Update', 'Updated to version ' + feed.version);
  send('update-progress', { step: 'installed' });
  setTimeout(() => { app.relaunch(); app.exit(0); }, 1500);
  return { ok: true };
}
function rollback() {
  const s = getSettings();
  const prev = s.previousUiVersion;
  const target = prev && fs.existsSync(path.join(UI_DIR(), prev, 'index.html')) ? prev : null;
  saveSettings({ uiVersion: target, previousUiVersion: null });
  logEvent('Update', 'Went back to version ' + (target || bundledVersion()));
  setTimeout(() => { app.relaunch(); app.exit(0); }, 600);
  return { ok: true, version: target || bundledVersion() };
}

/* ---------------- programs on this PC ---------------- */
function openProgram(p) {
  const known = { excel: 'start "" excel', word: 'start "" winword', photos: 'start "" ms-photos:', calc: 'start "" calc', notepad: 'start "" notepad' };
  if (p === 'downloads') return shell.openPath(app.getPath('downloads'));
  if (p === 'documents') return shell.openPath(app.getPath('documents'));
  if (known[p]) { exec(known[p], { shell: 'cmd.exe' }, err => { if (err) send('toast', 'Could not open ' + p); }); return Promise.resolve(''); }
  return shell.openPath(p);
}

/* ---------------- IPC ---------------- */
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:set', (e, patch) => {
  const s = saveSettings(patch);
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'startWithWindows')) { try { app.setLoginItemSettings({ openAtLogin: !!patch.startWithWindows }); } catch (err) {} }
  return s;
});
ipcMain.handle('auth:status', () => authStatus());
ipcMain.handle('auth:signin', () => signIn());
ipcMain.handle('auth:signout', () => signOut());
ipcMain.handle('data:sales', async (e, fresh) => { try { return await getJson(LOG_URL + '?action=sales' + (fresh ? '&fresh=1' : '') + '&t=' + Date.now(), 90000); } catch (err) { return { ok: false, error: 'Could not reach the Label Log. Check the internet.' }; } });
ipcMain.handle('data:gatetoday', async () => { try { return await getJson(LOG_URL + '?action=gatetoday&t=' + Date.now(), 60000); } catch (err) { return { ok: false, error: String(err) }; } });
ipcMain.handle('log:list', () => readJson(LOG_FILE(), []));
ipcMain.handle('log:add', (e, a, w) => { logEvent(a, w); return true; });
ipcMain.handle('app:info', () => ({ version: activeUi().version, shell: app.getVersion(), bundled: bundledVersion(), previous: getSettings().previousUiVersion || null, history: getSettings().updateHistory || [], lastCheck: getSettings().lastUpdateCheck || null, platform: process.platform }));
ipcMain.handle('update:check', () => checkUpdate());
ipcMain.handle('update:install', () => installUpdate());
ipcMain.handle('update:rollback', () => rollback());
ipcMain.handle('printers:list', async () => { try { return (await win.webContents.getPrintersAsync()).map(p => ({ name: p.name, isDefault: p.isDefault })); } catch (e) { return []; } });
ipcMain.handle('program:open', (e, p) => openProgram(p));
ipcMain.handle('file:open', (e, p) => shell.openPath(p));
ipcMain.handle('file:show', (e, p) => { shell.showItemInFolder(p); return true; });
ipcMain.handle('link:external', (e, url) => shell.openExternal(url));
ipcMain.handle('dialog:program', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Pick a program', properties: ['openFile'], filters: [{ name: 'Programs', extensions: ['exe', 'lnk', 'bat', 'cmd', 'msc'] }, { name: 'All files', extensions: ['*'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:image', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Pick a background picture', properties: ['openFile'], filters: [{ name: 'Pictures', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
  if (r.canceled) return null;
  const src = r.filePaths[0], ext = path.extname(src).toLowerCase();
  const dst = path.join(USER(), 'background' + ext);
  fs.copyFileSync(src, dst);
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + fs.readFileSync(dst).toString('base64');
});
ipcMain.handle('notify', (e, title, body) => { if (Notification.isSupported()) new Notification({ title, body, icon: path.join(__dirname, 'build', 'icon.png') }).show(); return true; });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  setupSession();
  createWindow();
  setTimeout(async () => { if (getSettings().notifyUpdates === false) return; const c = await checkUpdate(); if (c.available) send('update-available', c); }, 8000);
});
app.on('window-all-closed', () => app.quit());
