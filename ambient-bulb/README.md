# Ambient Bulb for YouTube

Makes your Wi-Fi smart bulb (Havells Digitap and other Tuya-based bulbs) follow the colours of the YouTube video you're watching, like the "Ambient light for YouTube" extension but in your room.

```
YouTube tab ──(content script samples frames)──▶ extension background
     ──HTTP──▶ local bridge (Node, 127.0.0.1:8765) ──Wi-Fi/LAN──▶ bulb
```

## Why there's a small "bridge"
Chrome extensions can't open raw TCP sockets, and the bulb only speaks the encrypted Tuya LAN protocol. So a tiny Node.js program runs on your PC, receives colours from the extension, and sends them to the bulb over your Wi-Fi. No cloud, low latency.

## 1. Get your bulb's ID, local key and IP
Havells Digitap bulbs are generally built on the Tuya platform. You need three things: **device ID**, **local key**, **IP**.

1. Install the **Smart Life** (or Tuya Smart) app and add the bulb there (reset bulb: switch on/off 3 times until it blinks). If the Digitap app keeps it, try Smart Life pairing anyway — most Tuya OEM bulbs pair fine.
2. Create a free account at <https://iot.tuya.com>, create a Cloud project (Smart Home, India data centre), and under **Devices → Link App Account** scan the QR code with Smart Life.
3. Run the wizard to pull the keys:
   ```bash
   npx @tuyapi/cli wizard
   ```
   (or `pip install tinytuya && python -m tinytuya wizard`, which also scans your LAN for the IP and protocol version).

> Note: re-pairing the bulb in another app changes its local key. If you go back to Digitap, re-run the wizard.

## 2. Run the bridge
```bash
cd bridge
npm install
cp config.example.json config.json   # fill in id, key, ip, version (usually 3.3 or 3.4)
npm start
```
If colours look wrong or nothing happens, set `"schema": "v1"` (older bulbs use data points 1/2/5 instead of 20/21/24). tinytuya's scan shows which DPS your bulb reports.

## 3. Load the extension
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `extension` folder.
3. Open a YouTube video (reload the tab once after installing), click the extension icon, press **Off → On**.

Popup controls:
- **Updates/sec** — Tuya bulbs handle ~5–8 updates/sec comfortably; higher can make them lag.
- **Smoothing** — higher = calmer transitions, lower = snappier scene changes.

Turning it off sets the bulb back to white.
