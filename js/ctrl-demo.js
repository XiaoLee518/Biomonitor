// Demo mode state machine
// Source: biomonitor_v26.html lines 3414-3640

// ============================================================
// DEMO MODE — floating panel simulates ESP32 physical buttons
// State: demo_idle → demo_calibrating → demo_running → demo_paused
// ============================================================
let _demoState   = 'idle';   // idle | calibrating | waiting_for_start | running | paused
let _demoTick    = 0;
let _demoInterval = null;
let _calibInterval = null;
let _calibSec    = 0;
let _hasBaselineSim = false;

// ─────────────────────────────────────────────────────────────
// Demo 面板按鈕狀態對照表
//
//  狀態                BTN1                      BTN2
//  ──────────────────────────────────────────────────────────
//  idle                開機/開始校正              disabled (灰)
//  calibrating         強制停止/關機              disabled (灰)
//  waiting_for_start   強制停止/關機              開始量測 (綠)
//  running             暫停                      停止量測
//  paused              繼續                      停止量測
// ─────────────────────────────────────────────────────────────
function dpUpdatePanel() {
  const ph   = document.getElementById('dpPhase');
  const btn1 = document.getElementById('dpBtn1');
  const btn2 = document.getElementById('dpBtn2');
  const tmr  = document.getElementById('dpTimer');

  ph.className  = 'dp-phase';
  btn1.disabled = false;
  btn2.disabled = false;

  if (_demoState === 'idle') {
    ph.classList.add('ph-idle');   ph.textContent = 'IDLE';
    btn1.textContent = 'BTN1 — 開機 / 開始校正';
    btn1.className   = 'dp-btn dp-btn-start';
    btn2.textContent = 'BTN2 — 開始量測';
    btn2.className   = 'dp-btn dp-btn-pause';
    btn2.disabled    = true;
    document.getElementById('dpCalibFill').style.width = '0%';
    tmr.textContent  = '等待操作...';

  } else if (_demoState === 'calibrating') {
    ph.classList.add('ph-calib');  ph.textContent = 'CALIBRATING';
    btn1.textContent = 'BTN1 — 強制停止 / 關機';
    btn1.className   = 'dp-btn dp-btn-stop';
    btn2.textContent = 'BTN2 — 校正中，請稍候…';
    btn2.className   = 'dp-btn dp-btn-pause';
    btn2.disabled    = true;
    tmr.textContent  = `校正中 ${_calibSec}/${CFG.calib}s`;

  } else if (_demoState === 'waiting_for_start') {
    ph.classList.add('ph-paused'); ph.textContent = '校正完成';
    btn1.textContent = 'BTN1 — 強制停止 / 關機';
    btn1.className   = 'dp-btn dp-btn-stop';
    btn2.textContent = 'BTN2 — 開始量測';
    btn2.className   = 'dp-btn dp-btn-start';
    btn2.disabled    = false;
    tmr.textContent  = '基準值就緒，按 BTN2 開始';

  } else if (_demoState === 'running') {
    ph.classList.add('ph-run');    ph.textContent = 'RUNNING';
    btn1.textContent = 'BTN1 — 暫停';
    btn1.className   = 'dp-btn dp-btn-pause';
    btn2.textContent = 'BTN2 — 停止量測';
    btn2.className   = 'dp-btn dp-btn-stop';
    tmr.textContent  = `量測中 ${_demoTick}s`;

  } else if (_demoState === 'paused') {
    ph.classList.add('ph-paused'); ph.textContent = 'PAUSED';
    btn1.textContent = 'BTN1 — 繼續';
    btn1.className   = 'dp-btn dp-btn-start';
    btn2.textContent = 'BTN2 — 停止量測';
    btn2.className   = 'dp-btn dp-btn-stop';
    tmr.textContent  = `暫停中 (${_demoTick}s)`;
  }
}

// ─────────────────────────────────────────────────────────────
// BTN1：主控制開關
//   idle              → 開機 + 開始校正
//   calibrating       → 強制停止 / 關機
//   waiting_for_start → 強制停止 / 關機
//   running           → 暫停
//   paused            → 繼續
// ─────────────────────────────────────────────────────────────
document.getElementById('dpBtn1').addEventListener('click', () => {
  if (_demoState === 'idle') {
    _demoState = 'calibrating';
    _calibSec  = 0;
    _hasBaselineSim = false;
    document.getElementById('dpCalibFill').style.width = '0%';
    ingestPacket('STATUS,CALIBRATING');
    dpUpdatePanel();

    _calibInterval = setInterval(() => {
      _calibSec++;
      const pct = Math.min(100, _calibSec / CFG.calib * 100);
      document.getElementById('dpCalibFill').style.width = pct + '%';
      document.getElementById('dpTimer').textContent = `校正中 ${_calibSec}/${CFG.calib}s`;

      // ★ Send DATA packets during calibration so calibBuf gets filled
      // Simulate resting physiology: low stress, stable HR/GSR/Resp
      const n = () => (Math.random() - 0.5) * 30;
      const hr  = Math.round(2000 + n());
      const gsr = Math.round(1800 + n());
      const rr  = Math.round(1500 + n());
      const bpm = +(68 + (Math.random() - 0.5) * 4).toFixed(1);
      const rpm = +(14 + (Math.random() - 0.5) * 2).toFixed(1);
      ingestPacket(`DATA,${_calibSec.toFixed(2)},${gsr},${hr},${rr},${bpm},${rpm},0`);

      if (_calibSec >= CFG.calib) {
        clearInterval(_calibInterval);
        _hasBaselineSim = true;
        // 送出基準值封包，前端更新基準值顯示
        ingestPacket('BASELINE,1800,2000,1500');
        // ★ 進入「等待 BTN2」狀態 — 不自動 RUNNING
        _demoState = 'waiting_for_start';
        dpUpdatePanel();
      }
    }, 1000);

  } else if (_demoState === 'calibrating') {
    clearInterval(_calibInterval);
    _calibSec = 0;
    document.getElementById('dpCalibFill').style.width = '0%';
    ingestPacket('STATUS,STOPPED');
    _demoState = 'idle';
    dpUpdatePanel();

  } else if (_demoState === 'waiting_for_start') {
    ingestPacket('STATUS,STOPPED');
    _demoState = 'idle';
    _calibSec  = 0;
    document.getElementById('dpCalibFill').style.width = '0%';
    dpUpdatePanel();

  } else if (_demoState === 'running') {
    clearInterval(_demoInterval);
    _demoState = 'paused';
    ingestPacket('STATUS,PAUSED');
    dpUpdatePanel();

  } else if (_demoState === 'paused') {
    _demoState = 'running';
    ingestPacket('STATUS,RUNNING');
    dpUpdatePanel();
    _startDemoDataStream();
  }
});

// ─────────────────────────────────────────────────────────────
// BTN2：量測開關
//   idle / calibrating  → disabled，不動作
//   waiting_for_start   → ★ 開始量測 (RUNNING)
//   running / paused    → 停止量測
// ─────────────────────────────────────────────────────────────
document.getElementById('dpBtn2').addEventListener('click', () => {
  if (_demoState === 'idle' || _demoState === 'calibrating') {
    return; // button is disabled, ignore
  }

  if (_demoState === 'waiting_for_start') {
    // ★ 核心修正：校正完成 → BTN2 → 正式開始量測
    _demoState = 'running';
    _demoTick  = 0;
    ingestPacket('STATUS,RUNNING');
    dpUpdatePanel();
    _startDemoDataStream();

  } else if (_demoState === 'running' || _demoState === 'paused') {
    clearInterval(_demoInterval);
    clearInterval(_calibInterval);
    ingestPacket('STATUS,STOPPED');
    _demoState = 'idle';
    _demoTick  = 0;
    dpUpdatePanel();
  }
});

// Close panel
document.getElementById('demoPanelClose').addEventListener('click', () => {
  document.getElementById('demoPanel').classList.add('hidden');
});

// Draggable panel
(function() {
  const panel = document.getElementById('demoPanel');
  const head  = document.getElementById('demoPanelHead');
  let ox=0, oy=0, startX=0, startY=0;
  head.addEventListener('mousedown', e => {
    startX = e.clientX - panel.offsetLeft;
    startY = e.clientY - panel.offsetTop;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    const move = ev => {
      panel.style.left = (ev.clientX - startX) + 'px';
      panel.style.top  = (ev.clientY - startY) + 'px';
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
})();

function _startDemoDataStream() {
  clearInterval(_demoInterval);
  _demoInterval = setInterval(() => {
    if (_demoState !== 'running') return;
    _demoTick++;
    const n   = () => (Math.random() - 0.5) * 50;
    const t   = parseFloat((_demoTick / 30).toFixed(2)); // 30 pts/sec → time in seconds
    const stressEnv = 0.35 + 0.25 * Math.sin(t * 0.04) + 0.15 * Math.sin(t * 0.11);
    const hr  = Math.round(2000 + stressEnv * 500 + n());
    const gsr = Math.round(1800 - stressEnv * 300 + n());
    const rr  = Math.round(1500 + stressEnv * 300 + n());
    const bpm = +(70 + stressEnv * 30).toFixed(1);
    const rpm = +(14 + stressEnv * 8).toFixed(1);
    const score = +(Math.min(100, Math.max(0, stressEnv * 120))).toFixed(1);
    ingestPacket(`DATA,${t},${gsr},${hr},${rr},${bpm},${rpm},${score}`);
    if (_demoTick % 30 === 0) {
      document.getElementById('dpTimer').textContent = `量測中 ${Math.floor(_demoTick/30)}s`;
    }
  }, 33); // ~30 fps
}


function stopDemo() {
  clearInterval(_demoInterval);
  clearInterval(_calibInterval);
  if (_demoState !== 'idle') {
    ingestPacket('STATUS,STOPPED');
    _demoState = 'idle';
    dpUpdatePanel();
  }
}

