// Fala com o serviço da Apple (Apple Mobile Device Service / usbmuxd) e abre um túnel pelo cabo até o iPhone.
const net = require('net');

// ---- plist XML mínimo (sem dependências) ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function buildVal(v) {
  if (typeof v === 'number') return `<integer>${Math.trunc(v)}</integer>`;
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>';
  return `<string>${esc(v)}</string>`;
}
function buildPlist(obj) {
  const body = Object.entries(obj).map(([k, v]) => `<key>${esc(k)}</key>${buildVal(v)}`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${body}</dict></plist>`;
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function parsePlist(xml) {
  const toks = xml.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, '').match(/<[^>]+>|[^<]+/g).filter((t) => t.trim() !== '');
  let i = 0;
  const text = (tag) => { let s = ''; while (toks[i] !== `</${tag}>`) s += toks[i++]; i++; return unesc(s); };
  function val() {
    const t = toks[i++];
    if (t === '<plist version="1.0">' || t.startsWith('<plist')) { const v = val(); return v; }
    if (t === '<dict>') { const o = {}; while (toks[i] !== '</dict>') { i++; const k = text('key'); o[k] = val(); } i++; return o; }
    if (t === '<dict/>') return {};
    if (t === '<array>') { const a = []; while (toks[i] !== '</array>') a.push(val()); i++; return a; }
    if (t === '<array/>') return [];
    if (t === '<integer>') return Number(text('integer'));
    if (t === '<real>') return Number(text('real'));
    if (t === '<string>') return text('string');
    if (t === '<string/>') return '';
    if (t === '<data>') return text('data');
    if (t === '<date>') return text('date');
    if (t === '<true/>') return true;
    if (t === '<false/>') return false;
    return null;
  }
  return val();
}

// ---- protocolo usbmux ----
let tag = 1;
function openSock() {
  return process.platform === 'win32' ? net.connect(27015, '127.0.0.1') : net.connect('/var/run/usbmuxd');
}

function request(s, obj) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => { cleanup(); reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })); }, 4000);
    const onErr = (e) => { cleanup(); reject(e); };
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length < 4) return;
      const len = buf.readUInt32LE(0);
      if (buf.length < len) return;
      cleanup();
      s.pause();
      const rest = buf.subarray(len);
      if (rest.length) s.unshift(rest);
      try { resolve(parsePlist(buf.subarray(16, len).toString('utf8'))); } catch (e) { reject(e); }
    };
    const cleanup = () => { clearTimeout(timer); s.removeListener('data', onData); s.removeListener('error', onErr); };
    s.on('data', onData);
    s.on('error', onErr);
    const body = Buffer.from(buildPlist({ ...obj, ClientVersionString: 'trofeu-espelho', ProgName: 'TrofeuEspelho' }));
    const h = Buffer.alloc(16);
    h.writeUInt32LE(16 + body.length, 0);
    h.writeUInt32LE(1, 4);   // versão
    h.writeUInt32LE(8, 8);   // tipo: plist
    h.writeUInt32LE(tag++, 12);
    s.write(Buffer.concat([h, body]));
  });
}

async function listDevices() {
  const s = openSock();
  try {
    const r = await request(s, { MessageType: 'ListDevices' });
    const all = r.DeviceList || [];
    listDevices.last = { total: all.length, types: all.map((d) => d.Properties && d.Properties.ConnectionType), keys: Object.keys(r) };
    return all
      .filter((d) => d.Properties && d.Properties.ConnectionType !== 'Network')
      .map((d) => ({ id: d.DeviceID, serial: d.Properties.SerialNumber }));
  } finally { s.destroy(); }
}

async function connect(deviceId, port) {
  const s = openSock();
  const p = ((port & 0xff) << 8) | (port >> 8); // porta em ordem de rede
  const r = await request(s, { MessageType: 'Connect', DeviceID: deviceId, PortNumber: p });
  if (r.Number !== 0) { s.destroy(); throw Object.assign(new Error('porta fechada'), { code: 'PORT' }); }
  return s;
}

module.exports = { listDevices, connect, parsePlist, buildPlist };
