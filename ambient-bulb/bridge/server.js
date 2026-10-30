// Local HTTP bridge: Chrome extension -> this server -> bulb over LAN (Tuya local protocol).
const http = require('http');
const fs = require('fs');
const path = require('path');
const TuyAPI = require('tuyapi');

const cfgPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(cfgPath)) {
  console.error('Missing config.json — copy config.example.json and fill in your bulb details.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const PORT = cfg.port || 8765;

// Tuya data-point IDs. "v2" = newer bulbs (20-24), "v1" = older bulbs (1,2,3,5).
const DPS = cfg.schema === 'v1'
  ? { power: '1', mode: '2', colour: '5' }
  : { power: '20', mode: '21', colour: '24' };

const device = new TuyAPI({ id: cfg.id, key: cfg.key, ip: cfg.ip, version: cfg.version || '3.3', issueGetOnConnect: false });
let connected = false, original = null;

device.on('connected', () => { connected = true; console.log('Bulb connected'); });
device.on('disconnected', () => { connected = false; console.log('Bulb disconnected, retrying…'); setTimeout(connect, 2000); });
device.on('error', e => console.warn('Bulb error:', e.message));
device.on('data', d => { if (!original && d.dps) original = d.dps; });

async function connect() {
  try { await device.find(); await device.connect(); } catch (e) { console.warn('Connect failed:', e.message); setTimeout(connect, 3000); }
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

const hex = (n, len) => Math.round(n).toString(16).padStart(len, '0');

function encodeColour({ r, g, b, brightness }) {
  const { h, s } = rgbToHsv(r, g, b);
  const minB = cfg.minBrightness ?? 0.1;
  const v = Math.min(1, Math.max(minB, brightness * 1.4)); // scenes are usually darker than you'd want the room
  if (cfg.schema === 'v1') {
    // rrggbb0hhhssvv
    const k = v * 255 / Math.max(r, g, b, 1);
    return hex(r * k, 2) + hex(g * k, 2) + hex(b * k, 2)
      + hex(h, 4) + hex(s * 255, 2) + hex(v * 255, 2);
  }
  // HHHHSSSSVVVV  (h 0-360, s 0-1000, v 0-1000)
  return hex(h, 4) + hex(s * 1000, 4) + hex(v * 1000, 4);
}

let busy = false, next = null;
async function apply(color) {
  if (!connected) return;
  if (busy) { next = color; return; }
  busy = true;
  try {
    await device.set({ multiple: true, data: { [DPS.power]: true, [DPS.mode]: 'colour', [DPS.colour]: encodeColour(color) } });
  } catch (e) { console.warn('Set failed:', e.message); }
  busy = false;
  if (next) { const n = next; next = null; apply(n); }
}

function body(req) {
  return new Promise(res => { let s = ''; req.on('data', c => s += c); req.on('end', () => res(s)); });
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/health') return res.end(JSON.stringify({ ok: true, bulb: connected ? 'online' : 'offline' }));
  if (req.url === '/color' && req.method === 'POST') {
    try { apply(JSON.parse(await body(req))); } catch {}
    return res.end('{"ok":true}');
  }
  if (req.url === '/restore' && req.method === 'POST') {
    if (connected) await device.set({ multiple: true, data: { [DPS.mode]: 'white' } }).catch(() => {});
    return res.end('{"ok":true}');
  }
  res.statusCode = 404; res.end();
}).listen(PORT, '127.0.0.1', () => console.log(`Bridge listening on http://127.0.0.1:${PORT}`));

connect();
