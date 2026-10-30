// Samples the YouTube video frame, computes a dominant colour and sends it to the bridge.
const SAMPLE_W = 32, SAMPLE_H = 18;
const canvas = document.createElement('canvas');
canvas.width = SAMPLE_W; canvas.height = SAMPLE_H;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let enabled = false, timer = null, last = null, settings = { fps: 6, smoothing: 0.5 };
let smoothed = null;

function dominantColor(video) {
  ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const d = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
  let r = 0, g = 0, b = 0, w = 0, lum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const pr = d[i], pg = d[i + 1], pb = d[i + 2];
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
    // Weight saturated, bright pixels more so the bulb picks up the scene's "mood" colour.
    const weight = 1 + ((max - min) / 255) * 4 * (max / 255);
    r += pr * weight; g += pg * weight; b += pb * weight; w += weight;
    lum += 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
  }
  return { r: r / w, g: g / w, b: b / w, brightness: lum / (d.length / 4) / 255 };
}

function tick() {
  const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
  if (!video || video.paused || video.readyState < 2) return;
  let c;
  try { c = dominantColor(video); } catch (e) { return; } // tainted / not ready
  const a = settings.smoothing;
  smoothed = smoothed
    ? { r: smoothed.r * a + c.r * (1 - a), g: smoothed.g * a + c.g * (1 - a),
        b: smoothed.b * a + c.b * (1 - a), brightness: smoothed.brightness * a + c.brightness * (1 - a) }
    : c;
  const out = { r: Math.round(smoothed.r), g: Math.round(smoothed.g), b: Math.round(smoothed.b),
                brightness: +smoothed.brightness.toFixed(3) };
  // Skip tiny changes to avoid flooding the bulb.
  if (last && Math.abs(out.r - last.r) + Math.abs(out.g - last.g) + Math.abs(out.b - last.b) < 12
      && Math.abs(out.brightness - last.brightness) < 0.04) return;
  last = out;
  chrome.runtime.sendMessage({ type: 'color', color: out });
}

function start() {
  stop();
  timer = setInterval(tick, 1000 / settings.fps);
}
function stop() {
  clearInterval(timer); timer = null; last = null; smoothed = null;
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === 'setEnabled') {
    enabled = msg.enabled;
    if (msg.settings) settings = { ...settings, ...msg.settings };
    enabled ? start() : stop();
    reply({ enabled });
  } else if (msg.type === 'getState') {
    reply({ enabled });
  }
});
