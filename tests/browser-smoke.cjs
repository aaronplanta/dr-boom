// Optional real-browser checks, using Chrome's native debugging protocol.
// Start a dedicated headless Chrome with --remote-debugging-port=9228 first.
// Run: node tests/browser-smoke.cjs [port]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const port = process.argv[2] || '9228';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.join(__dirname, '../.preview');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const tab = tabs.find(item => item.type === 'page' && !item.url.startsWith('chrome://'));
  assert.ok(tab, 'Dedicated browser page is available');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) call.reject(new Error(JSON.stringify(message.error)));
      else call.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errors.push(message.params.entry.text);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const callId = ++id;
      const timer = setTimeout(() => { pending.delete(callId); reject(new Error(`Timed out: ${method}`)); }, 10000);
      pending.set(callId, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: callId, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression, timeout = 5000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (await evaluate(expression)) return;
      await sleep(50);
    }
    throw new Error(`Condition timed out: ${expression}`);
  }
  const read = id => evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
  const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const keyCodes = { ArrowRight: 39, ArrowDown: 40, ArrowLeft: 37, ArrowUp: 38, Space: 32, KeyP: 80, KeyR: 82, Enter: 13 };
  async function press(code, hold = 30) {
    const key = code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCodes[code] });
    await sleep(hold);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCodes[code] });
  }
  async function screenshot(name) {
    const clip = await evaluate(`({ x: 0, y: 0, width: document.documentElement.clientWidth, height: document.documentElement.scrollHeight, scale: 1 })`);
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    fs.writeFileSync(path.join(output, name), Buffer.from(data, 'base64'));
  }
  const playerX = () => evaluate(`(() => {
    const canvas = document.getElementById('game-canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, 600, 520).data;
    let sum = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 118 && pixels[i + 1] === 176 && pixels[i + 2] === 237) { sum += (i / 4) % 600; count++; }
    }
    return count ? sum / count : null;
  })()`);

  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(path.join(__dirname, '../index.html')).href });
    await waitFor(`document.readyState === 'complete' && document.getElementById('start-button') && typeof Game === 'function'`);
    assert.equal(await read('arena-status'), 'AWAITING PLAYER');
    await screenshot('desktop-ready.png');
    console.log('PASS: direct file startup and desktop canvas rendering');

    await click('start-button');
    await waitFor(`document.getElementById('game-overlay').hidden`);
    assert.equal(await read('arena-status'), 'EXPERIMENT IN PROGRESS');
    const startX = await playerX();
    await press('ArrowRight', 180);
    await sleep(150);
    assert.ok(await playerX() > startX + 30, 'Arrow input visibly moves the player');
    await press('Space');
    assert.ok((await read('bombs')).startsWith('01'));
    await press('KeyP');
    const pausedTime = await read('timer');
    await sleep(1100);
    assert.equal(await read('timer'), pausedTime);
    assert.equal(await read('arena-status'), 'EXPERIMENT PAUSED');
    console.log('PASS: keyboard movement, bomb placement, and pause freeze');

    await click('start-button');
    await waitFor(`document.getElementById('arena-status').textContent === 'EXPERIMENT CONCLUDED'`, 5000);
    assert.equal(await evaluate(`document.getElementById('game-overlay').hidden`), false);
    assert.equal(await read('start-label'), 'ONE MORE TRY');
    await press('KeyR');
    assert.equal(await read('arena-status'), 'EXPERIMENT IN PROGRESS');
    assert.ok((await read('bombs')).startsWith('02'));
    assert.equal(await read('score'), '00000');
    console.log('PASS: real timed detonation, loss overlay, and keyboard restart');

    // Plant at spawn, then run beyond the two-cell blast before the fuse ends.
    await press('Space');
    await press('ArrowRight', 550);
    assert.ok(await playerX() > 150);
    await screenshot('desktop-playing.png');
    await sleep(1950);
    assert.equal(await read('arena-status'), 'EXPERIMENT IN PROGRESS');
    await screenshot('desktop-explosion.png');
    await evaluate(`window.dispatchEvent(new Event('blur'))`);
    assert.equal(await read('arena-status'), 'EXPERIMENT PAUSED');
    console.log('PASS: escaping fire and automatic focus-loss pause');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await send('Page.reload');
    await waitFor(`document.readyState === 'complete' && typeof Game === 'function' && document.getElementById('arena-status')?.textContent === 'AWAITING PLAYER'`);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    assert.equal(await evaluate('window.innerWidth'), 390, 'Mobile viewport really is phone-sized');
    await screenshot('mobile-ready.png');
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'No mobile horizontal overflow');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.touch-controls')).display`), 'flex');
    await click('start-button');
    const mobileStart = await playerX();
    const center = await evaluate(`(() => {
      const rect = document.querySelector('[data-move="right"]').getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...center, id: 1 }] });
    await sleep(180);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(160);
    assert.ok(await playerX() > mobileStart + 30, 'Touch direction visibly moves player');
    const releasedX = await playerX();
    await sleep(200);
    assert.ok(Math.abs(await playerX() - releasedX) < 1, 'Touch release stops movement');
    await click('touch-bomb');
    assert.ok((await read('bombs')).startsWith('01'));
    await screenshot('mobile-playing.png');
    assert.deepEqual(errors, [], 'No browser exceptions or resource errors');
    console.log('PASS: phone layout, touch movement/release, and touch bomb control');
    console.log('PASS: zero browser errors; screenshots saved in .preview/');
  } finally {
    ws.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
