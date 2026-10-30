// Forwards colours from the YouTube tab to the local bridge (service worker isn't blocked by page CSP).
const BRIDGE = 'http://127.0.0.1:8765';
let inFlight = false, pending = null;

async function send(color) {
  if (inFlight) { pending = color; return; } // keep only the newest colour
  inFlight = true;
  try {
    await fetch(`${BRIDGE}/color`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(color)
    });
  } catch (e) { console.warn('Bridge unreachable:', e.message); }
  inFlight = false;
  if (pending) { const p = pending; pending = null; send(p); }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'color') send(msg.color);
  if (msg.type === 'ping') {
    fetch(`${BRIDGE}/health`).then(r => r.json()).then(reply).catch(e => reply({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'restore') {
    fetch(`${BRIDGE}/restore`, { method: 'POST' }).catch(() => {});
  }
});
