const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const usbmux = require('./usbmux');

const PORT = 7878;
let win, link = null;

// ---------- Configurações ----------
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
const DEFAULTS = {
  resolution: 1080, fps: 60, bitrate: 12, audio: true, volume: 100, latency: 'baixa',
  decode: 'rapido', render: 'suave', brightness: 50, saturation: 50, contrast: 50,
  cursor: 'rato', frame: true, onTop: false, height: 820, recFormat: 'mp4',
  saveDir: '', lastIp: ''
};
function loadCfg() { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch { return { ...DEFAULTS }; } }
let cfg;

// ---------- Conexão com o iPhone ----------
class Link {
  constructor(sock, mode) {
    this.s = sock; this.mode = mode; this.buf = Buffer.alloc(0);
    sock.setNoDelay(true);
    sock.on('data', (d) => this.onData(d));
    sock.on('close', () => { if (link === this) { link = null; send('m:closed', mode); } });
    sock.on('error', () => {});
    sock.resume();
    this.sendCfg();
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const t = this.buf[0], len = this.buf.readUInt32BE(1);
      if (this.buf.length < 5 + len) break;
      const p = Buffer.from(this.buf.subarray(5, 5 + len));
      this.buf = this.buf.subarray(5 + len);
      this.handle(t, p);
    }
  }
  handle(t, p) {
    if (t === 1) send('m:hello', JSON.parse(p.toString('utf8')));
    else if (t === 2) send('m:video', { key: (p[0] & 1) === 1, pts: Number(p.readBigInt64BE(1)), data: p.subarray(9) });
    else if (t === 3) send('m:audio', { rate: p.readUInt32BE(0), ch: p[4], pcm: p.subarray(5) });
    else if (t === 4) send('m:rot', p.readUInt16BE(0));
  }
  write(t, payload = Buffer.alloc(0)) {
    const h = Buffer.alloc(5); h[0] = t; h.writeUInt32BE(payload.length, 1);
    this.s.write(Buffer.concat([h, payload]));
  }
  sendCfg() {
    const c = { fps: cfg.fps, bitrate: cfg.bitrate * 1_000_000, shortSide: cfg.resolution, audio: cfg.audio };
    this.write(16, Buffer.from(JSON.stringify(c)));
  }
  close() { this.s.destroy(); }
}
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }
function attach(sock, mode) { if (link) link.close(); link = new Link(sock, mode); return true; }

// ---------- Janela ----------
function createWindow() {
  win = new BrowserWindow({
    width: 390, height: 760, frame: false, transparent: true, resizable: false, maximizable: false,
    backgroundColor: '#00000000', title: 'Trofeu Espelho', icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false }
  });
  win.setAlwaysOnTop(!!cfg.onTop);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
  if (process.env.TROFEU_SHOTS) {
    let n = 0;
    setInterval(async () => { const img = await win.capturePage(); fs.writeFileSync(path.join(process.env.TROFEU_SHOTS, `s${n++}.png`), img.toPNG()); }, 2500);
  }
}

app.whenReady().then(() => {
  cfg = loadCfg();
  if (!cfg.saveDir) cfg.saveDir = path.join(app.getPath('videos'), 'Trofeu Espelho');
  createWindow();
});
app.on('window-all-closed', () => { if (link) link.close(); app.quit(); });

// ---------- IPC ----------
ipcMain.handle('cfg:get', () => ({ cfg, defaults: DEFAULTS, pc: os.hostname(), test: process.env.TROFEU_TEST || '' }));
ipcMain.handle('cfg:set', (_e, patch) => {
  cfg = { ...cfg, ...patch };
  fs.mkdirSync(path.dirname(cfgFile()), { recursive: true });
  fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2));
  if ('onTop' in patch) win.setAlwaysOnTop(!!cfg.onTop);
  if (link && ['fps', 'bitrate', 'resolution', 'audio'].some((k) => k in patch)) link.sendCfg();
  return cfg;
});
ipcMain.handle('cfg:reset', () => { const keep = { saveDir: cfg.saveDir, lastIp: cfg.lastIp }; cfg = { ...DEFAULTS, ...keep }; fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); win.setAlwaysOnTop(false); if (link) link.sendCfg(); return cfg; });

ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:close', () => win.close());
ipcMain.on('win:size', (_e, { w, h }) => {
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  w = Math.round(Math.min(w, wa.width)); h = Math.round(Math.min(h, wa.height));
  const x = Math.min(Math.max(wa.x, b.x + Math.round((b.width - w) / 2)), wa.x + wa.width - w);
  const y = Math.min(Math.max(wa.y, b.y), wa.y + wa.height - h);
  win.setBounds({ x, y, width: w, height: h });
});
ipcMain.on('win:fullscreen', (_e, on) => win.setFullScreen(on));

ipcMain.handle('usb:list', async () => {
  try { const devices = await usbmux.listDevices(); return { ok: true, devices, info: usbmux.listDevices.last }; }
  catch (e) { return { ok: false, error: e.code || e.message }; }
});
ipcMain.handle('usb:connect', async (_e, id) => {
  try { const s = await usbmux.connect(id, PORT); attach(s, 'usb'); return { ok: true }; }
  catch (e) { return { ok: false, error: e.code || e.message }; }
});

ipcMain.handle('wifi:connect', (_e, host) => new Promise((resolve) => {
  const s = net.connect({ host, port: PORT });
  const t = setTimeout(() => { s.destroy(); resolve({ ok: false, error: 'TIMEOUT' }); }, 4000);
  s.once('connect', () => { clearTimeout(t); attach(s, 'wifi'); resolve({ ok: true }); });
  s.once('error', (e) => { clearTimeout(t); resolve({ ok: false, error: e.code }); });
}));
// Procura iPhones com a transmissão ligada na rede local (porta 7878)
let scanning = false;
function probe(ip) {
  return new Promise((resolve) => {
    const s = net.connect({ host: ip, port: PORT });
    let buf = Buffer.alloc(0), done = false;
    const end = (v) => { if (done) return; done = true; clearTimeout(t); s.destroy(); resolve(v); };
    const t = setTimeout(() => end(null), 900);
    s.on('connect', () => { clearTimeout(t); setTimeout(() => end({ name: 'iPhone', ip }), 1500); });
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length >= 5 && buf[0] === 1) {
        const len = buf.readUInt32BE(1);
        if (buf.length >= 5 + len) { try { end({ name: JSON.parse(buf.subarray(5, 5 + len)).name, ip }); } catch { end({ name: 'iPhone', ip }); } }
      }
    });
    s.on('error', () => end(null));
  });
}
async function scanLan() {
  if (scanning) return; scanning = true;
  const bases = new Set();
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || [])
    if (a.family === 'IPv4' && !a.internal && /^(10|172|192)\./.test(a.address)) bases.add(a.address.split('.').slice(0, 3).join('.'));
  const found = [];
  await Promise.all([...bases].flatMap((b) => Array.from({ length: 254 }, (_, i) => probe(`${b}.${i + 1}`).then((r) => {
    if (r) { found.push(r); send('wifi:found', found); }
  }))));
  scanning = false;
  send('wifi:done', found);
}
ipcMain.on('wifi:scan', () => scanLan());
ipcMain.on('wifi:stop', () => {});

ipcMain.on('m:key', () => link && link.write(17));
ipcMain.on('m:disconnect', () => { if (link) { const l = link; link = null; l.close(); } });

ipcMain.handle('file:save', (_e, { name, data }) => {
  fs.mkdirSync(cfg.saveDir, { recursive: true });
  const p = path.join(cfg.saveDir, name);
  fs.writeFileSync(p, Buffer.from(data));
  return p;
});
ipcMain.on('file:openDir', () => { fs.mkdirSync(cfg.saveDir, { recursive: true }); shell.openPath(cfg.saveDir); });
ipcMain.on('file:show', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('file:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: cfg.saveDir });
  return r.canceled ? null : r.filePaths[0];
});
