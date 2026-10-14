// ================= Estado =================
let cfg = {}, DEF = {}, mode = null, view = 'home';
let usbTimer = null, connecting = false;
const $ = (id) => document.getElementById(id);
paintIcons();

const HOME_SIZE = { w: 390, h: 760 };
function sizeWin(w, h) { tro.send('win:size', { w, h }); }
function toast(t, ms = 2600) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms); }
function modal(html) { $('mText').innerHTML = html; $('modal').classList.remove('hidden'); }
$('mOk').onclick = () => $('modal').classList.add('hidden');

async function setCfg(patch) { cfg = await tro.invoke('cfg:set', patch); applyLook(); }

// ================= Navegação =================
function show(v) {
  view = v;
  const inCard = ['home', 'usb', 'conn', 'wifi'].includes(v);
  $('card').classList.toggle('hidden', !inCard);
  $('mirror').classList.toggle('hidden', v !== 'mirror');
  for (const [k, id] of [['home', 'vHome'], ['usb', 'vUsb'], ['conn', 'vConn'], ['wifi', 'vWifi']]) $(id).classList.toggle('hidden', k !== v);
  $('brand').classList.toggle('hidden', v !== 'home');
  $('btnHome').classList.toggle('hidden', v === 'home');
  $('menu').classList.add('hidden');
  if (inCard) sizeWin(HOME_SIZE.w, HOME_SIZE.h);
}

function goHome() {
  stopUsb(); tro.send('wifi:stop'); tro.send('m:disconnect');
  mode = null; closeSettings(); show('home');
}

$('btnHome').onclick = goHome;
$('btnMin').onclick = $('mMin').onclick = () => tro.send('win:min');
$('btnClose').onclick = () => tro.send('win:close');
$('btnMenu').onclick = (e) => { e.stopPropagation(); $('menu').classList.toggle('hidden'); };
document.addEventListener('click', () => $('menu').classList.add('hidden'));
$('menu').onclick = (e) => {
  const a = e.target.dataset.act;
  if (a === 'settings') openSettings('root');
  if (a === 'folder') tro.send('file:openDir');
  if (a === 'about') openSettings('sobre');
};

// ================= USB (prioridade) =================
$('goUsb').onclick = startUsb;
$('usbHelp').onclick = () => modal(`<b>Nenhum dispositivo detectado?</b><ol>
<li>Use um cabo original/MFi e desbloqueie o iPhone.</li>
<li>Toque em <b>Confiar</b> no aviso "Confiar neste computador?".</li>
<li>Tenha o app <b>Dispositivos Apple</b> (Microsoft Store) ou o <b>iTunes</b> instalado — ele traz o driver do iPhone.</li>
<li>No iPhone, abra o <b>Trofeu Espelho</b> e toque em <b>Iniciar espelhamento → Iniciar Transmissão</b>.</li></ol>`);

function startUsb() {
  mode = 'usb'; show('usb'); $('usbWarn').classList.add('hidden');
  stopUsb(); pollUsb(); usbTimer = setInterval(pollUsb, 1500);
}
function stopUsb() { clearInterval(usbTimer); usbTimer = null; }

async function pollUsb() {
  if (connecting || mode !== 'usb' || view === 'mirror') return;
  const r = await tro.invoke('usb:list');
  if (mode !== 'usb' || view === 'mirror') return;
  if (!r.ok) {
    if (view !== 'usb') show('usb');
    $('usbWarn').innerHTML = 'Serviço do iPhone não encontrado no PC. Instale o app <b>Dispositivos Apple</b> (Microsoft Store) ou o <b>iTunes</b> e abra o Trofeu Espelho de novo.';
    $('usbWarn').classList.remove('hidden');
    return;
  }
  if (!r.devices.length) {
    if (view !== 'usb') show('usb');
    $('usbWarn').innerHTML = `Serviço da Apple OK, mas nenhum iPhone no cabo.<br>Desbloqueie o iPhone e toque em <b>Confiar</b>. Feche o ApowerMirror se estiver aberto.<br><small>diag: ${JSON.stringify(r.info)}</small>`;
    $('usbWarn').classList.remove('hidden');
    return;
  }
  $('usbWarn').classList.add('hidden');
  connecting = true;
  if (view !== 'conn') show('conn');
  $('connTitle').textContent = 'Conectando...';
  const c = await tro.invoke('usb:connect', r.devices[0].id);
  connecting = false;
  if (c.ok) { enterMirror(); return; }
  $('connTitle').textContent = 'iPhone detectado ✓';
  $('connHint').innerHTML = 'No iPhone, abra o app <b>Trofeu Espelho</b> e toque em<br><b>Iniciar espelhamento → Iniciar Transmissão</b>.';
}

// ================= Wi‑Fi =================
$('goWifi').onclick = startWifi;
function startWifi() {
  mode = 'wifi'; stopUsb(); show('wifi');
  $('ipIn').value = cfg.lastIp || '';
  scanWifi();
}
function scanWifi() {
  $('wifiList').innerHTML = '<p class="hint">Procurando na rede... Deixe a transmissão iniciada no iPhone.</p>';
  tro.send('wifi:scan');
}
tro.on('wifi:done', (list) => {
  if (list.length) return;
  $('wifiList').innerHTML = '<p class="hint">Nenhum iPhone encontrado. No iPhone toque em <b>Iniciar espelhamento</b> e <a class="link" id="reScan">procure de novo</a>.</p>';
  $('reScan').onclick = scanWifi;
});
tro.on('wifi:found', (list) => {
  const el = $('wifiList');
  el.innerHTML = '';
  list.forEach((d) => {
    const row = document.createElement('div'); row.className = 'dev';
    row.innerHTML = `<div>${d.name.replace(/</g, '')}<small>${d.ip}</small></div><button class="btn sm">Conectar</button>`;
    row.querySelector('button').onclick = () => wifiConnect(d.ip);
    el.appendChild(row);
  });
});
$('ipGo').onclick = () => wifiConnect($('ipIn').value.trim());
$('ipIn').onkeydown = (e) => { if (e.key === 'Enter') $('ipGo').click(); };
async function wifiConnect(ip) {
  if (!ip) return;
  show('conn'); $('connTitle').textContent = 'Conectando...'; $('connHint').textContent = ip;
  const r = await tro.invoke('wifi:connect', ip);
  if (r.ok) { setCfg({ lastIp: ip }); tro.send('wifi:stop'); enterMirror(); }
  else { show('wifi'); toast('Não conectou. Confira se a transmissão está iniciada no iPhone e se estão no mesmo Wi‑Fi.', 4000); }
}

// ================= Espelhamento =================
const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
let dec = null, needKey = true, paused = false, phoneRot = 0, userRot = 0, gotFrame = false, lastKeyReq = 0;
let vidW = 1080, vidH = 2340;

function enterMirror() {
  stopUsb(); gotFrame = false; needKey = true; phoneRot = 0;
  $('wait').classList.remove('hidden'); $('wait').textContent = 'Aguardando imagem do iPhone...';
  closeSettings(); show('mirror'); makeDec(); layout();
}

let decGen = 0;
async function makeDec() {
  const gen = ++decGen;
  try { if (dec && dec.state !== 'closed') dec.close(); } catch {}
  dec = null; needKey = true;
  const pref = cfg.decode === 'rapido' ? ['prefer-hardware', 'no-preference', 'prefer-software'] : ['prefer-software', 'no-preference', 'prefer-hardware'];
  let conf = null;
  outer: for (const codec of ['avc1.640034', 'avc1.64002A', 'avc1.4D402A', 'avc1.42E01F'])
    for (const hw of pref) {
      const c = { codec, optimizeForLatency: true, hardwareAcceleration: hw };
      try { if ((await VideoDecoder.isConfigSupported(c)).supported) { conf = c; break outer; } } catch {}
    }
  if (gen !== decGen) return;
  if (!conf) { $('wait').classList.remove('hidden'); $('wait').textContent = 'Este PC não conseguiu abrir o decodificador H.264. Atualize o driver de vídeo.'; return; }
  const d = new VideoDecoder({
    output: onFrame,
    error: (e) => { console.warn('decoder', e.name, e.message); if (gen === decGen) setTimeout(() => { makeDec(); askKey(true); }, 300); }
  });
  d.configure(conf);
  dec = d; askKey(true);
}
function askKey(force) { const n = performance.now(); if (force || n - lastKeyReq > 500) { lastKeyReq = n; tro.send('m:key'); } }

tro.on('m:video', (v) => {
  if (view !== 'mirror' || !dec || dec.state !== 'configured') return;
  if (needKey) { if (!v.key) { askKey(); return; } needKey = false; }
  if (dec.decodeQueueSize > 8) { needKey = true; askKey(true); return; }
  try { dec.decode(new EncodedVideoChunk({ type: v.key ? 'key' : 'delta', timestamp: v.pts, data: v.data })); }
  catch (e) { needKey = true; askKey(true); }
});
tro.on('m:rot', (deg) => { phoneRot = deg; });
tro.on('m:hello', (h) => { $('wait').textContent = `Conectado a ${h.name}. Mexa no iPhone para aparecer a imagem.`; });
tro.on('m:closed', (m) => {
  if (view !== 'mirror') return;
  if (rec) stopRec();
  toast('Conexão encerrada');
  if (m === 'usb') startUsb(); else startWifi();
});

function onFrame(f) {
  if (paused) { f.close(); return; }
  const rot = (phoneRot + userRot) % 360;
  const fw = f.displayWidth, fh = f.displayHeight;
  const w = rot % 180 ? fh : fw, h = rot % 180 ? fw : fh;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; vidW = w; vidH = h; layout(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (rot) { ctx.translate(w / 2, h / 2); ctx.rotate(rot * Math.PI / 180); ctx.drawImage(f, -fw / 2, -fh / 2); }
  else ctx.drawImage(f, 0, 0);
  f.close();
  if (!gotFrame) { gotFrame = true; $('wait').classList.add('hidden'); }
}

function layout() {
  const frame = cfg.frame !== false;
  const bez = frame ? 13 : 0;
  const a = vidW / vidH;
  let sh = cfg.height || 820, sw = sh * a;
  if (a > 1) { sw = (cfg.height || 820) * 1.25; sh = sw / a; }
  sw = Math.round(sw); sh = Math.round(sh);
  const scr = $('screen'); scr.style.width = sw + 'px'; scr.style.height = sh + 'px';
  $('phone').classList.toggle('noframe', !frame);
  sizeInk();
  if (view === 'mirror' && !document.fullscreenElement && !isFull) sizeWin(sw + bez * 2 + 6 + 56 + 24, sh + bez * 2 + 42 + 16);
}

function applyLook() {
  cv.style.filter = `brightness(${cfg.brightness / 50}) saturate(${cfg.saturation / 50}) contrast(${cfg.contrast / 50})`;
  cv.classList.toggle('nitido', cfg.render === 'nitido');
  cv.classList.toggle('dedo', cfg.cursor === 'dedo');
  $('mPin').classList.toggle('on', !!cfg.onTop);
  if (gain) gain.gain.value = cfg.volume / 100;
  if (view === 'mirror') layout();
}

// ---- botões ----
function togglePause() {
  paused = !paused;
  $('pausedTag').classList.toggle('hidden', !paused);
  $('mPause').innerHTML = ICONS[paused ? 'play' : 'pause'];
  if (!paused) { needKey = true; askKey(true); }
}
$('mPause').onclick = togglePause;
$('mPin').onclick = () => { setCfg({ onTop: !cfg.onTop }); toast(cfg.onTop ? 'Sempre no topo: desligado' : 'Sempre no topo: ligado'); };
$('mRot').onclick = () => { userRot = (userRot + 90) % 360; needKey = true; askKey(true); };
$('mClose').onclick = goHome;

let isFull = false;
function toggleFull() { isFull = !isFull; tro.send('win:fullscreen', isFull); $('tFull').classList.toggle('on', isFull); if (isFull) fitFull(); else { $('screen').style.transform = ''; layout(); } }
function fitFull() {
  setTimeout(() => {
    const scr = $('screen');
    const k = Math.min((innerHeight - 60) / scr.offsetHeight, (innerWidth - 120) / scr.offsetWidth);
    scr.style.width = Math.round(scr.offsetWidth * k) + 'px'; scr.style.height = Math.round(scr.offsetHeight * k) + 'px'; sizeInk();
  }, 250);
}
$('tFull').onclick = toggleFull;

function stamp() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; }
async function shot() {
  if (!gotFrame) return toast('Sem imagem ainda');
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const x = c.getContext('2d'); x.filter = cv.style.filter || 'none'; x.drawImage(cv, 0, 0);
  if (!$('ink').classList.contains('hidden')) { x.filter = 'none'; x.drawImage($('ink'), 0, 0, c.width, c.height); }
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const p = await tro.invoke('file:save', { name: `Captura_${stamp()}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
  toast('Captura salva ✓'); lastSaved = p;
}
let lastSaved = null;
$('tShot').onclick = shot;
$('tFolder').onclick = () => tro.send('file:openDir');
$('tHelp').onclick = () => modal(`<b>Atalhos rápidos</b><br>F11 tela cheia · Ctrl+S captura · Ctrl+R gravar · Ctrl+D desenhar · Espaço pausar · Ctrl+roda do mouse muda o tamanho.<br><br>Se a imagem travar, toque no iPhone ou use <b>Girar</b> para pedir um quadro novo.`);

// ---- gravação ----
let rec = null, recChunks = [], recStart = 0, recTick = null;
function pickMime() {
  const list = cfg.recFormat === 'webm'
    ? ['video/webm;codecs=vp9,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.640034,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=h264,opus', 'video/webm'];
  return list.find((m) => MediaRecorder.isTypeSupported(m));
}
function startRec() {
  if (!gotFrame) return toast('Sem imagem ainda');
  const stream = cv.captureStream(cfg.fps || 60);
  ensureAudio();
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = pickMime();
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.max(8, cfg.bitrate) * 1_000_000, audioBitsPerSecond: 192000 });
  recChunks = [];
  rec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  rec.onstop = async () => {
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recChunks, { type: mime });
    const p = await tro.invoke('file:save', { name: `Gravacao_${stamp()}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
    toast('Gravação salva ✓ (' + ext.toUpperCase() + ')'); lastSaved = p;
  };
  rec.start(1000); recStart = Date.now();
  $('tRec').classList.add('on'); $('recTime').classList.remove('hidden');
  recTick = setInterval(() => { const s = Math.floor((Date.now() - recStart) / 1000); $('recTime').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500);
}
function stopRec() { if (!rec) return; rec.stop(); rec = null; clearInterval(recTick); $('tRec').classList.remove('on'); $('recTime').classList.add('hidden'); $('recTime').textContent = '00:00'; }
$('tRec').onclick = () => (rec ? stopRec() : startRec());

// ---- desenho ----
const ink = $('ink'), ictx = ink.getContext('2d');
function sizeInk() { const r = $('screen'); const d = devicePixelRatio || 1; const w = Math.round(r.offsetWidth * d) || 1, h = Math.round(r.offsetHeight * d) || 1; if (ink.width !== w || ink.height !== h) { ink.width = w; ink.height = h; } }
function toggleInk() { ink.classList.toggle('hidden'); $('tInk').classList.toggle('on', !ink.classList.contains('hidden')); sizeInk(); }
$('tInk').onclick = toggleInk;
let drawing = false;
ink.onpointerdown = (e) => { drawing = true; ink.setPointerCapture(e.pointerId); ictx.beginPath(); const d = devicePixelRatio; ictx.moveTo(e.offsetX * d, e.offsetY * d); };
ink.onpointermove = (e) => { if (!drawing) return; const d = devicePixelRatio; ictx.lineTo(e.offsetX * d, e.offsetY * d); ictx.strokeStyle = '#ff2d55'; ictx.lineWidth = 4 * d; ictx.lineCap = ictx.lineJoin = 'round'; ictx.stroke(); };
ink.onpointerup = () => { drawing = false; };
ink.ondblclick = () => ictx.clearRect(0, 0, ink.width, ink.height);

// ---- tamanho com Ctrl + roda ----
window.addEventListener('wheel', (e) => {
  if (view !== 'mirror' || !e.ctrlKey || isFull) return;
  e.preventDefault();
  setCfg({ height: Math.max(420, Math.min(1500, (cfg.height || 820) + (e.deltaY < 0 ? 40 : -40))) });
}, { passive: false });

// ================= Áudio =================
let actx = null, gain = null, dest = null, nextT = 0;
function ensureAudio() {
  if (actx) return;
  actx = new AudioContext({ latencyHint: 'interactive' });
  gain = actx.createGain(); dest = actx.createMediaStreamDestination();
  gain.connect(actx.destination); gain.connect(dest);
  gain.gain.value = cfg.volume / 100;
}
tro.on('m:audio', ({ rate, ch, pcm }) => {
  if (view !== 'mirror' || !cfg.audio || paused) return;
  ensureAudio();
  const i16 = new Int16Array(pcm.slice().buffer);
  const frames = Math.floor(i16.length / ch);
  if (!frames) return;
  const buf = actx.createBuffer(ch, frames, rate);
  for (let c = 0; c < ch; c++) { const d = buf.getChannelData(c); for (let f = 0; f < frames; f++) d[f] = i16[f * ch + c] / 32768; }
  const src = actx.createBufferSource(); src.buffer = buf; src.connect(gain);
  const lat = cfg.latency === 'baixa' ? 0.07 : 0.2, now = actx.currentTime;
  if (nextT < now + 0.01 || nextT > now + lat + 0.3) nextT = now + lat;
  src.start(nextT); nextT += buf.duration;
});

// ================= Configurações =================
const PAGES = {
  root: { title: 'Configurações', items: [
    ['gear', 'Configurações gerais', 'geral'], ['phone', 'Configurações de espelhamento de celular', 'celular'],
    ['sound', 'Configurações de som', 'som'], ['keys', 'Definir Teclas de Atalho', 'atalhos'],
    ['info', 'Sobre', 'sobre'], ['q', 'Ajuda', 'ajuda']] },
  geral: { title: 'Configurações gerais', opts: [
    { sec: 'Janela' },
    { check: 'onTop', label: 'Sempre no topo' },
    { check: 'frame', label: 'Mostrar moldura do iPhone' },
    { sec: 'Capturas e gravações' },
    { radio: 'recFormat', label: 'Formato da gravação', vals: [['mp4', 'MP4 (recomendado)'], ['webm', 'WebM']] },
    { dir: true }] },
  celular: { title: 'Configurações de espelhamento de celular', opts: [
    { sec: 'Qualidade de exibição' },
    { radio: 'resolution', label: 'Resolução', vals: [[720, '720P'], [1080, '1080P'], [0, 'Nativa (máxima)']] },
    { radio: 'fps', label: 'Quadros por segundo', vals: [[30, '30 FPS'], [60, '60 FPS']] },
    { slider: 'bitrate', label: 'Qualidade do vídeo (Mbps)', min: 2, max: 40, unit: ' Mbps' },
    { sec: 'Configurações de display' },
    { radio: 'decode', label: 'Modo de decodificação (use compatibilidade se a tela ficar preta)', vals: [['rapido', 'Modo de alta velocidade'], ['compat', 'Modo de Compatibilidade']], redec: true },
    { radio: 'render', label: 'Modo de renderização', vals: [['suave', 'Suave'], ['nitido', 'Nítido (pixels)']] },
    { sec: 'Ajustes de cor' },
    { slider: 'brightness', label: 'Brilho', min: 0, max: 100 },
    { slider: 'saturation', label: 'Saturação', min: 0, max: 100 },
    { slider: 'contrast', label: 'Contraste', min: 0, max: 100 },
    { sec: 'Janela de espelhamento' },
    { slider: 'height', label: 'Tamanho da tela (Ctrl + roda do mouse)', min: 420, max: 1500, step: 20, unit: ' px' },
    { radio: 'cursor', label: 'Estilo do cursor', vals: [['rato', 'Rato'], ['dedo', 'Dedo']] }] },
  som: { title: 'Configurações de som', opts: [
    { sec: 'Som do iPhone' },
    { check: 'audio', label: 'Ativar som do iPhone no PC' },
    { slider: 'volume', label: 'Volume', min: 0, max: 100 },
    { radio: 'latency', label: 'Atraso do som', vals: [['baixa', 'Baixo'], ['normal', 'Normal (mais estável)']] }] },
  atalhos: { title: 'Definir Teclas de Atalho', html: () => `<div class="keys">${[
    ['Tela cheia', 'F11'], ['Captura de tela', 'Ctrl + S'], ['Gravar / parar', 'Ctrl + R'], ['Desenhar', 'Ctrl + D'],
    ['Sempre no topo', 'Ctrl + T'], ['Girar', 'Ctrl + Shift + R'], ['Pausar', 'Espaço'], ['Aumentar/diminuir tela', 'Ctrl + roda'], ['Sair / voltar', 'Esc']]
    .map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>` },
  sobre: { title: 'Sobre', html: () => `<div class="about"><div class="big">${ICONS.logo}</div><b>Trofeu Espelho</b><br>Versão 1.0<br>Espelhamento do iPhone no PC por cabo e Wi‑Fi.<br>Sem AirPlay — vídeos do TikTok aparecem normalmente.</div>` },
  ajuda: { title: 'Ajuda', html: () => `<div class="about" style="text-align:left"><b>Pelo cabo</b><ol><li>Conecte e toque em Confiar.</li><li>Clique em Conexão de USB.</li><li>No iPhone: Trofeu Espelho → Iniciar espelhamento.</li></ol><b>Pelo Wi‑Fi</b><ol><li>Mesma rede no PC e no iPhone.</li><li>Clique em Conexão de Wi‑Fi.</li><li>Inicie a transmissão no iPhone e clique em Conectar.</li></ol>Imagem preta? Mude para <b>Modo de Compatibilidade</b> em espelhamento de celular.</div>` }
};
let page = 'root';

function openSettings(p = 'root') {
  const host = view === 'mirror' ? $('mSetHost') : $('card');
  host.appendChild($('settings'));
  $('settings').classList.remove('hidden');
  renderPage(p);
}
function closeSettings() { $('settings').classList.add('hidden'); }
$('tSet').onclick = () => ($('settings').classList.contains('hidden') || $('settings').parentElement !== $('mSetHost') ? openSettings('root') : closeSettings());
$('sBack').onclick = () => (page === 'root' ? closeSettings() : renderPage('root'));

function renderPage(p) {
  page = p; const P = PAGES[p]; $('sTitle').textContent = P.title;
  const b = $('sBody'); b.innerHTML = ''; b.scrollTop = 0;
  if (P.items) {
    P.items.forEach(([ic, label, to]) => {
      const it = document.createElement('div'); it.className = 'item';
      it.innerHTML = `${ICONS[ic]}<span>${label}</span><i class="chev">${ICONS.chev}</i>`;
      it.onclick = () => renderPage(to); b.appendChild(it);
    });
    return;
  }
  if (P.html) { b.innerHTML = P.html(); return; }
  P.opts.forEach((o) => {
    if (o.sec) { b.insertAdjacentHTML('beforeend', `<div class="sec">${o.sec}</div>`); return; }
    const d = document.createElement('div'); d.className = 'opt';
    if (o.check) {
      d.innerHTML = `<label class="check"><input type="checkbox" ${cfg[o.check] ? 'checked' : ''}> ${o.label}</label>`;
      d.querySelector('input').onchange = (e) => setCfg({ [o.check]: e.target.checked });
    } else if (o.radio) {
      d.innerHTML = `<label class="t">${o.label}</label><div class="radios">${o.vals.map(([v, t]) =>
        `<label><input type="radio" name="${o.radio}" value="${v}" ${String(cfg[o.radio]) === String(v) ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
      d.querySelectorAll('input').forEach((inp) => inp.onchange = async () => {
        const v = typeof o.vals[0][0] === 'number' ? Number(inp.value) : inp.value;
        await setCfg({ [o.radio]: v });
        if (o.redec && view === 'mirror') { makeDec(); askKey(true); }
      });
    } else if (o.slider) {
      const u = o.unit || '';
      d.innerHTML = `<label class="t">${o.label}</label><div class="slider"><input type="range" min="${o.min}" max="${o.max}" step="${o.step || 1}" value="${cfg[o.slider]}"><em>${cfg[o.slider]}${u}</em></div>`;
      const r = d.querySelector('input'), em = d.querySelector('em');
      r.oninput = () => { em.textContent = r.value + u; cfg[o.slider] = Number(r.value); if (['brightness', 'saturation', 'contrast', 'volume'].includes(o.slider)) applyLook(); };
      r.onchange = () => setCfg({ [o.slider]: Number(r.value) });
    } else if (o.dir) {
      d.innerHTML = `<label class="t">Pasta de salvamento</label><div class="dirRow"><code title="${cfg.saveDir}">${cfg.saveDir}</code><button class="btn sm">Alterar</button><button class="btn sm">Abrir</button></div>`;
      const [ch, op] = d.querySelectorAll('button');
      ch.onclick = async () => { const p2 = await tro.invoke('file:pickDir'); if (p2) { await setCfg({ saveDir: p2 }); renderPage(page); } };
      op.onclick = () => tro.send('file:openDir');
    }
    b.appendChild(d);
  });
  const rs = document.createElement('a'); rs.className = 'restore'; rs.textContent = 'Restaurar configurações default';
  rs.onclick = async () => { cfg = await tro.invoke('cfg:reset'); applyLook(); renderPage(page); toast('Configurações restauradas'); };
  b.appendChild(rs);
}

// ================= Atalhos =================
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox' && e.target.type !== 'radio') return;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { if (isFull) toggleFull(); else if (!$('settings').classList.contains('hidden')) closeSettings(); else $('modal').classList.add('hidden'); return; }
  if (view !== 'mirror') return;
  if (e.key === 'F11') { e.preventDefault(); toggleFull(); }
  else if (e.ctrlKey && e.shiftKey && k === 'r') { e.preventDefault(); $('mRot').click(); }
  else if (e.ctrlKey && k === 's') { e.preventDefault(); shot(); }
  else if (e.ctrlKey && k === 'r') { e.preventDefault(); $('tRec').click(); }
  else if (e.ctrlKey && k === 'd') { e.preventDefault(); toggleInk(); }
  else if (e.ctrlKey && k === 't') { e.preventDefault(); $('mPin').click(); }
  else if (e.key === ' ') { e.preventDefault(); togglePause(); }
});

// ================= Início =================
(async () => {
  const r = await tro.invoke('cfg:get');
  cfg = r.cfg; DEF = r.defaults; $('pcName').textContent = r.pc;
  applyLook(); show('home');
  if (r.test === 'wifi') setTimeout(() => wifiConnect('127.0.0.1'), 3000);
  if (r.test === 'settings') setTimeout(() => { wifiConnect('127.0.0.1'); setTimeout(() => openSettings('celular'), 3500); }, 3000);
  if (r.test === 'usb') startUsb();
})();
