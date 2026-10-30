const $ = id => document.getElementById(id);
let tabId, enabled = false;

function render() {
  $('toggle').textContent = enabled ? 'On — syncing' : 'Off';
  $('toggle').className = enabled ? 'on' : '';
}
function settings() {
  return { fps: +$('fps').value, smoothing: +$('smoothing').value / 100 };
}
async function push() {
  await chrome.storage.local.set(settings());
  chrome.tabs.sendMessage(tabId, { type: 'setEnabled', enabled, settings: settings() });
}

(async () => {
  const s = await chrome.storage.local.get(['fps', 'smoothing']);
  if (s.fps) $('fps').value = s.fps;
  if (s.smoothing != null) $('smoothing').value = Math.round(s.smoothing * 100);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  if (!/^https:\/\/www\.youtube\.com\//.test(tab.url || '')) {
    $('toggle').disabled = true; $('status').textContent = 'Open a YouTube video to use this.'; return;
  }
  chrome.tabs.sendMessage(tabId, { type: 'getState' }, r => {
    if (chrome.runtime.lastError) { $('status').textContent = 'Reload the YouTube tab once.'; return; }
    enabled = !!r?.enabled; render();
  });
  chrome.runtime.sendMessage({ type: 'ping' }, r => {
    $('status').textContent = r?.ok ? `Bridge connected · bulb ${r.bulb}` : 'Bridge not running (see README).';
  });
})();

$('toggle').onclick = () => {
  enabled = !enabled; render(); push();
  if (!enabled) chrome.runtime.sendMessage({ type: 'restore' });
};
$('fps').onchange = $('smoothing').onchange = () => enabled && push();
