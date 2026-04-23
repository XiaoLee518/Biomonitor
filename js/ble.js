// BLE connection
// Source: biomonitor_v26.html lines 3038-3097

// ============================================================
// BLE
// ============================================================
const SVC_UUID  = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

document.getElementById('btnBle').addEventListener('click', () => document.getElementById('bleModal').classList.add('show'));
document.getElementById('btnBleCancel').addEventListener('click', () => document.getElementById('bleModal').classList.remove('show'));

document.getElementById('btnBleScan').addEventListener('click', async () => {
  const statusEl = document.getElementById('bleModalStatus');
  if (!navigator.bluetooth) { statusEl.textContent = '此瀏覽器不支援 Web Bluetooth（請使用 Chrome）。'; return; }
  try {
    statusEl.textContent = '掃描中...';
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'ESP32_Biometric_System' }],
      optionalServices: [SVC_UUID],
    });
    S.bleDevice = device;
    statusEl.textContent = '連線中...';
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SVC_UUID);
    S.bleChar     = await service.getCharacteristic(CHAR_UUID);
    await S.bleChar.startNotifications();
    let bleLineBuffer='';
    S.bleChar.addEventListener('characteristicvaluechanged', e=>{
      bleLineBuffer+=new TextDecoder().decode(e.target.value);
      const lns=bleLineBuffer.split('\n');bleLineBuffer=lns.pop();
      for(const ln of lns){const t=ln.trim();if(t)ingestPacket(t);}
    });
    S.connected = true;
    S.connMode = 'ble';
    setBleUI(true);
    document.getElementById('bleModal').classList.remove('show');
    // 連線成功 → 顯示「等待 ESP32 狀態」，不做任何其他動作
    // 等待 ESP32 onConnect 發送的 STATUS,xxx 封包來同步狀態
    document.getElementById('statusMainText').textContent = 'BLE 已連線 — 等待 ESP32 狀態同步...';
    document.getElementById('statusSubText').textContent  = '';
    device.addEventListener('gattserverdisconnected', () => {
      S.connected = false; S.connMode = null; setBleUI(false);
      setPhaseUI('idle', 'BLE 斷線 — 請重新連接');
    });
  } catch (err) {
    statusEl.textContent = '錯誤: ' + err.message;
  }
});

function setBleUI(on) {
  document.getElementById('bleDot').className   = 'ble-dot' + (on ? ' on' : '');
  document.getElementById('bleText').textContent = on ? (typeof _lang!=='undefined'&&_lang==='en'?'BLE Connected':'BLE 已連線') : (typeof _lang!=='undefined'&&_lang==='en'?'BLE Disconnected':'BLE 未連線');
  updateCtrlBtn();
}

async function bleWrite(cmd) {
  if (S.connMode !== 'ble' || !S.bleChar) return;
  try {
    await S.bleChar.writeValue(new TextEncoder().encode(cmd));
  } catch (e) { console.warn('BLE write error:', e); }
}

