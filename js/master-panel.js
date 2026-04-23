// Master panel, demo control, drag, mini charts
// v12.4 — 兩階段校正按鈕邏輯：Phase 1 閾值校正 → Phase 2 基準值採集

// ============================================================
// MASTER PANEL (主控面板)
// ============================================================
let _mp = {
  state: 'idle',
  // ★ 新增 'thresh_calibrating' 狀態
  // idle | thresh_calibrating | calibrating | waiting_for_start | running | paused
  mode:  'none',  // none | ble | usb | demo
  threshSec: 0,   // ★ Phase 1 計時
  calibSec: 0,    // Phase 2 計時
  calibPhase: 'none',  // 'thresh' | 'calib'
  calibTimer: null,
};

let _demoCalibSec = 0;
let _demoCalibInterval = null;
let _mpCalibInitDone = false;

function mpUpdate() {
  const mainBtn  = document.getElementById('mpMainBtn');
  const stopBtn  = document.getElementById('mpStopBtn');
  const pill     = document.getElementById('mpPhasePill');
  const hint     = document.getElementById('mpHint');
  const timerSub = document.getElementById('mpTimerSub');
  if (!mainBtn) return;

  const s = _mp.state;
  const connected = _mp.mode !== 'none';

  const pillCfg = {
    idle:               'idle',
    thresh_calibrating: 'calib',   // ★
    calibrating:        'calib',
    waiting_for_start:  'ready',
    running:            'running',
    paused:             'paused',
    ended:              'idle',
  };
  if (pill) pill.className = pillCfg[s] || 'idle';
  if (pill) pill.textContent = {
    idle:               'IDLE',
    thresh_calibrating: 'THRESH CAL',  // ★
    calibrating:        'CALIBRATING',
    waiting_for_start:  'READY',
    running:            'RUNNING',
    paused:             'PAUSED',
    ended:              'ENDED',
  }[s] || 'IDLE';

  const btnCfg = {
    idle:               { cls:'idle',    txt: typeof t==='function'?t('mp_start_calib'):'開始校正',    dis:!connected },
    thresh_calibrating: { cls:'calib',   txt: typeof t==='function'?t('mp_stop_calib'):'中止校正',    dis:false },  // ★
    calibrating:        { cls:'calib',   txt: typeof t==='function'?t('mp_stop_calib'):'中止校正',    dis:false },
    waiting_for_start:  { cls:'ready',   txt: typeof t==='function'?t('mp_start_meas'):'開始量測',    dis:false },
    running:            { cls:'running', txt: typeof t==='function'?t('mp_pause'):'暫停量測',         dis:false },
    paused:             { cls:'paused',  txt: typeof t==='function'?t('mp_resume'):'繼續量測',        dis:false },
  };
  const bc = btnCfg[s] || btnCfg.idle;
  mainBtn.className = bc.cls;
  mainBtn.textContent = bc.txt;
  mainBtn.disabled = bc.dis;

  const active = (s === 'running' || s === 'paused');
  if (stopBtn) {
    stopBtn.disabled = !(active || s === 'waiting_for_start');
    stopBtn.textContent = typeof t === 'function' ? t('mp_stop') : '停止';
  }

  const resetBtn = document.getElementById('mpResetBtn');
  if (resetBtn) {
    const hasData = S.hr && S.hr.length > 0;
    const showReset = hasData && (s === 'idle' || s === 'waiting_for_start');
    resetBtn.style.display = showReset ? 'block' : 'none';
  }

  const _isEN = typeof _lang !== 'undefined' && _lang === 'en';
  const tc = CFG.thresh_calib || 20;
  const hints = {
    idle:               connected
      ? (_isEN ? `Press Start Calibration to begin threshold detection (${tc}s) + baseline (${CFG.calib}s)` : `按「開始校正」先偵測動態閾值（${tc}秒），再採集靜息基準值（${CFG.calib}秒）`)
      : (_isEN ? 'Please select a connection method' : '請先選擇連線方式'),
    thresh_calibrating: (_isEN
      ? `Phase 1 — detecting HR & Resp peak thresholds... ${_mp.threshSec}/${tc}s`
      : `第一階段 — 偵測心率 & 呼吸峰值閾值... ${_mp.threshSec}/${tc}s`),
    calibrating:        (_isEN ? 'Phase 2 — collecting resting baseline ' : '第二階段 — 採集靜息基準值... ') + _mp.calibSec + '/' + CFG.calib + 's',
    waiting_for_start:  _isEN ? 'Calibration complete — press Start Measurement' : '校正完成，按「開始量測」正式記錄',
    running:            _isEN ? 'Measuring — press Pause or Stop' : '量測中 — 按「暫停」或「停止」',
    paused:             _isEN ? 'Paused — press Resume or Stop' : '已暫停 — 按「繼續」或「停止」',
  };
  if (hint) hint.textContent = hints[s] || '';

  const timerSubTxt = {
    idle:               _isEN ? 'Waiting' : '等待開始',
    thresh_calibrating: _isEN ? 'Phase 1 Threshold' : '第一階段 閾值校正',  // ★
    calibrating:        _isEN ? 'Phase 2 Baseline'  : '第二階段 基準值採集',
    waiting_for_start:  _isEN ? 'Ready to measure'  : '等待開始量測',
    running:            _isEN ? 'Measuring' : '量測計時',
    paused:             _isEN ? 'Paused' : '暫停中',
  };
  if (timerSub) timerSub.textContent = timerSubTxt[s] || '';
}

function mpUpdateConn() {
  const dot   = document.getElementById('mpConnDot');
  const label = document.getElementById('mpConnLabel');
  ['mpBleBtn','mpUsbBtn','mpDemoBtn'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.remove('active');
  });
  const cfg = {
    none:{ cls:'',    lbl: typeof _lang!=='undefined'&&_lang==='en'?'Not Connected':'未連線' },
    ble: { cls:'ble', lbl: typeof _lang!=='undefined'&&_lang==='en'?'BLE Connected':'BLE 已連線', active:'mpBleBtn' },
    usb: { cls:'usb', lbl: typeof _lang!=='undefined'&&_lang==='en'?'USB Connected':'USB 已連線', active:'mpUsbBtn' },
    demo:{ cls:'demo',lbl: typeof _lang!=='undefined'&&_lang==='en'?'Demo Mode':'Demo 模式',      active:'mpDemoBtn' },
  };
  const c = cfg[_mp.mode] || cfg.none;
  if (dot)   dot.className = c.cls;
  if (label) label.textContent = c.lbl;
  if (c.active) { const el = document.getElementById(c.active); if (el) el.classList.add('active'); }
  mpUpdate();
}

function mpUpdateStats(bpm, rpm, score) {
  const sc = score>=80?'var(--red)':score>=60?'#f2666a':score>=30?'var(--yellow)':'var(--green)';
  const bpmEl  = document.getElementById('mpBPM');
  const rpmEl  = document.getElementById('mpRPM');
  const scEl   = document.getElementById('mpScore');
  const scVal  = document.getElementById('mpScoreVal');
  const scFill = document.getElementById('mpScoreFill');
  if (bpmEl)  bpmEl.textContent  = bpm>0 ? Math.round(bpm) : '--';
  if (rpmEl)  rpmEl.textContent  = rpm>0 ? rpm.toFixed(1)  : '--';
  if (scEl)   { scEl.textContent = Math.round(score); scEl.style.color = sc; }
  if (scVal)  { scVal.textContent = Math.round(score); scVal.style.color = sc; }
  if (scFill) scFill.style.width = Math.min(100, score) + '%';
}

function mpUpdateGSR(chgPct, level) {
  const dot = document.getElementById('mpGsrDot');
  const val = document.getElementById('mpGsrVal');
  if (!dot || !val) return;
  const sign = chgPct >= 0 ? '+' : '';
  val.textContent = sign + chgPct.toFixed(1) + '%';
  if (level === 'hi') {
    dot.style.background = 'var(--red)'; dot.style.boxShadow = '0 0 5px var(--red)'; val.style.color = 'var(--red)';
  } else if (level === 'warn') {
    dot.style.background = 'var(--yellow)'; dot.style.boxShadow = '0 0 5px var(--yellow)'; val.style.color = 'var(--yellow)';
  } else {
    dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 5px var(--green)'; val.style.color = 'var(--green)';
  }
}

// ── 主按鈕事件 ───────────────────────────────────────────────
document.getElementById('mpMainBtn')?.addEventListener('click', () => {
  const s = _mp.state;
  if      (s === 'idle')              mpDoCalib();
  else if (s === 'thresh_calibrating') mpDoStop();  // ★ 中止 Phase 1 也走 stop
  else if (s === 'calibrating')       mpDoStop();
  else if (s === 'waiting_for_start') mpDoStart();
  else if (s === 'running')           mpDoPause();
  else if (s === 'paused')            mpDoResume();
});
document.getElementById('mpStopBtn')?.addEventListener('click', () => mpDoStop());

// ── ★ 開始校正（Phase 1 閾值校正先行）───────────────────────
function mpDoCalib() {
  if (_mp.mode === 'none') return;

  // 先停止任何殘留計時器
  clearInterval(_mp.calibTimer);
  _mp.calibTimer = null;

  _mp.state      = 'thresh_calibrating';
  _mp.threshSec  = 0;
  _mp.calibSec   = 0;
  _mp.calibPhase = 'thresh';

  // 重置進度條
  const f = document.getElementById('mpCalibFill');
  if (f) f.style.width = '0%';

  if (_mp.mode === 'demo') {
    ingestPacket('STATUS,THRESH_CALIBRATING');
    _demoStartThreshCalib();
  } else {
    // BLE/USB：設旗讓 STATUS,THRESH_CALIBRATING 封包回來時跳過重複重置
    _mpCalibInitDone = true;
    ingestPacket('STATUS,THRESH_CALIBRATING');
    deviceWrite('CALIB');
  }

  // ★ Phase 1 前端計時器（真實模式由 THRESH_PROG 驅動進度條；
  //    此計時器僅用於更新 hint 文字和 threshSec 計數，不控制進度條）
  const tc = CFG.thresh_calib || 20;
  _mp.calibTimer = setInterval(() => {
    if (_mp.calibPhase !== 'thresh') { clearInterval(_mp.calibTimer); _mp.calibTimer = null; return; }
    _mp.threshSec++;
    mpUpdate();
    if (_mp.threshSec >= tc + 2) {
      // 安全 fallback：如果 THRESH_DONE 遲遲沒到，強制停止計時器
      clearInterval(_mp.calibTimer); _mp.calibTimer = null;
    }
  }, 1000);

  mpUpdate();
}

// ── ★ THRESH_DONE 封包觸發的 Phase 2 計時器啟動 ─────────────
// 由 packet.js 的 THRESH_DONE handler 呼叫
window._mpOnThreshDone = function() {
  // ★ 必須先清除 Phase 1 計時器，再啟動 Phase 2，避免雙重 tick
  clearInterval(_mp.calibTimer);
  _mp.calibTimer = null;

  _mp.calibPhase = 'calib';
  _mp.calibSec   = 0;

  // 重置進度條，準備 Phase 2
  const f = document.getElementById('mpCalibFill');
  if (f) f.style.width = '0%';

  // 更新 hint：THRESH_DONE 到 STATUS,CALIBRATING 之間的短暫過渡
  mpUpdate();

  // ★ Phase 2 計時器：等 STATUS,CALIBRATING 封包到達後才真正啟動
  //   (由 cpOnPhaseChange_mp 偵測到 'calibrating' 時觸發 _mpStartPhase2Timer)
  //   這裡先記錄旗標，避免在 STATUS,CALIBRATING 之前就開始計時
  _mp._pendingPhase2Timer = true;
};

// ★ 實際啟動 Phase 2 計時器（由 cpOnPhaseChange_mp 在確認 state='calibrating' 後呼叫）
function _mpStartPhase2Timer() {
  if (!_mp._pendingPhase2Timer) return;
  _mp._pendingPhase2Timer = false;

  clearInterval(_mp.calibTimer);
  _mp.calibTimer = null;
  _mp.calibSec = 0;

  _mp.calibTimer = setInterval(() => {
    if (_mp.calibPhase !== 'calib') { clearInterval(_mp.calibTimer); _mp.calibTimer = null; return; }
    _mp.calibSec++;
    const pct = Math.min(100, _mp.calibSec / CFG.calib * 100);
    const fEl = document.getElementById('mpCalibFill');
    if (fEl) fEl.style.width = pct + '%';
    mpUpdate();
    if (_mp.calibSec >= CFG.calib + 2) { clearInterval(_mp.calibTimer); _mp.calibTimer = null; }
  }, 1000);
}

function mpDoStart() {
  if (_mp.mode === 'demo') {
    _demoStartMeasure();
  } else {
    deviceWrite('START');
    enterRunning();
  }
}
function mpDoPause() {
  if (_mp.mode === 'demo') { _mp.state = 'paused'; ingestPacket('STATUS,PAUSED'); }
  else { deviceWrite('PAUSE'); _mp.state = 'paused'; }
  mpUpdate();
}
function mpDoResume() {
  if (_mp.mode === 'demo') { _mp.state = 'running'; ingestPacket('STATUS,RUNNING'); }
  else { deviceWrite('RESUME'); _mp.state = 'running'; }
  mpUpdate();
}
function mpDoStop() {
  clearInterval(_mp.calibTimer);
  _mp.calibTimer = null;
  _mp.threshSec = 0; _mp.calibSec = 0; _mp.calibPhase = 'none';
  _mp._pendingPhase2Timer = false;
  const f = document.getElementById('mpCalibFill');
  if (f) f.style.width = '0%';
  if (_mp.mode === 'demo') { ingestPacket('STATUS,STOPPED'); ingestPacket('END'); }
  else if (_mp.mode !== 'none') deviceWrite('STOP');
  _mp.state = 'idle';
  mpUpdate();
}

// ── Sync from ESP32 status packets ───────────────────────────
function cpOnPhaseChange_mp(newPhase) {
  const pm = {
    idle:'idle', thresh_calibrating:'thresh_calibrating', calibrating:'calibrating',
    waiting_for_start:'waiting_for_start', running:'running', paused:'paused', ended:'idle',
  };

  // Phase 1 → Phase 2 自動轉換：
  // THRESH_DONE 已設 _pendingPhase2Timer=true，等 STATUS,CALIBRATING 到達後才真正啟動計時器
  if (newPhase === 'calibrating' && _mp.state === 'thresh_calibrating') {
    _mp.state = 'calibrating';
    mpUpdate();
    // ★ 在確認進入 calibrating 狀態後才啟動 Phase 2 計時器
    _mpStartPhase2Timer();
    return;
  }

  if (newPhase === 'waiting_for_start') {
    clearInterval(_mp.calibTimer);
    _mp.calibTimer = null;
    _mp._pendingPhase2Timer = false;
    const f = document.getElementById('mpCalibFill');
    if (f) { f.style.width = '100%'; setTimeout(() => { f.style.width = '0%'; }, 800); }
  }

  _mp.state = pm[newPhase] || 'idle';
  mpUpdate();
}

// ── Connection buttons ────────────────────────────────────────
document.getElementById('mpBleBtn')?.addEventListener('click', () => document.getElementById('bleModal').classList.add('show'));
document.getElementById('mpUsbBtn')?.addEventListener('click', () => { /* USB removed */ });
document.getElementById('mpDemoBtn')?.addEventListener('click', () => {
  if (_mp.mode === 'demo') { mpDoStop(); _mp.mode = 'none'; }
  else { _mp.mode = 'demo'; _mp.state = 'idle'; }
  mpUpdateConn(); mpUpdate();
});
document.getElementById('mpCamBtn')?.addEventListener('click', async () => {});
document.getElementById('mpCsvBtn')?.addEventListener('click', () => exportCsv());

// ── 重新量測按鈕 ─────────────────────────────────────────────
document.getElementById('mpResetBtn')?.addEventListener('click', () => {
  const overlay = document.getElementById('resetConfirmOverlay');
  if (overlay) overlay.classList.add('show');
});

// ── 清除資料 Modal ────────────────────────────────────────────
function _doReset(keepBaseline) {
  const overlay = document.getElementById('resetConfirmOverlay');
  if (overlay) overlay.classList.remove('show');

  if (_mp.mode === 'demo') {
    clearInterval(_mp.calibTimer);
    clearInterval(_mp.demoDataTimer);
  } else if (S.connMode && (S.phase === 'running' || S.phase === 'paused')) {
    deviceWrite('STOP');
  }

  S.hr = []; S.gsr = []; S.resp = []; S.score = [];
  if (typeof rrDetectReset === 'function') rrDetectReset();
  if (typeof hrDetectReset === 'function') hrDetectReset();
  S.gsrTriggers = 0; S.gsrConsec = 0;
  S._lastChartT = -999;
  S.calibBuf = null;

  if (!keepBaseline) {
    S.base = { hr: null, gsr: null, resp: null };
    S.threshHR = null; S.threshResp = null;
    S.calibEndSec = null;
    updateBaselineUI();
    ;['hr','gsr','resp'].forEach(key => {
      const chart = liveCharts[key];
      if (chart) { chart.data.datasets[2].data = []; chart.update('none'); }
    });
    ;['bpm','rpm'].forEach(key => {
      const chart = liveCharts[key];
      if (chart) { chart.data.datasets[2].data = []; chart.update('none'); }
    });
  }

  ;['hr','gsr','resp'].forEach(key => {
    const chart = liveCharts[key];
    if (!chart) return;
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update('none');
  });
  ;['bpm','rpm'].forEach(key => {
    const chart = liveCharts[key];
    if (!chart) return;
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    if (!keepBaseline) chart.data.datasets[2].data = [];
    chart.update('none');
  });
  if (liveCharts.overview) {
    liveCharts.overview.data.datasets.forEach(ds => ds.data = []);
    liveCharts.overview.update('none');
  }

  cancelAnimationFrame(S.timerRaf);
  cancelAnimationFrame(S._mpTimerRaf);
  document.getElementById('mainTimer').textContent = '00:00';
  const mpT = document.getElementById('mpTimer');
  if (mpT) mpT.textContent = '00:00';

  const logBody = document.getElementById('liveLogBody');
  if (logBody) logBody.innerHTML = '';
  const logCount = document.getElementById('logCount');
  if (logCount) logCount.textContent = '0 rows';

  updateStressGauge(0);

  const hasBase = keepBaseline && S.base && (S.base.hr != null || S.base.gsr != null);
  if (hasBase) {
    _mp.state = 'waiting_for_start';
    setPhaseUI('waiting_for_start');
    if (_mp.mode === 'demo') ingestPacket('STATUS,WAITING_FOR_START');
  } else {
    _mp.state = 'idle';
    setPhaseUI('idle');
  }
  mpUpdate();
  const _rb = document.getElementById('mpResetBtn'); if (_rb) _rb.style.display = 'none';
}

document.getElementById('btnResetCancel')?.addEventListener('click', () => {
  document.getElementById('resetConfirmOverlay')?.classList.remove('show');
});
document.getElementById('btnResetKeepBase')?.addEventListener('click', () => _doReset(true));
document.getElementById('btnResetClearAll')?.addEventListener('click', () => _doReset(false));

// ── Sync timer to mpTimer ─────────────────────────────────────
const _origStartTimer = startTimer;
window.startTimer = function() {
  _origStartTimer();
  function mpTick() {
    if (!S.startMs) return;
    const el = document.getElementById('mpTimer');
    if (el) {
      const s = Math.floor((Date.now() - S.startMs) / 1000);
      el.textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
    }
    S._mpTimerRaf = requestAnimationFrame(mpTick);
  }
  cancelAnimationFrame(S._mpTimerRaf);
  S._mpTimerRaf = requestAnimationFrame(mpTick);
};

// ══════════════════════════════════════════════════════════════
// DEMO MODE — 兩階段模擬
// ══════════════════════════════════════════════════════════════

// ★ Phase 1 Demo：模擬閾值校正波形
function _demoStartThreshCalib() {
  _demoCalibSec = 0;
  clearInterval(_demoCalibInterval);
  const tc = CFG.thresh_calib || 20;

  // 以 20Hz 模擬 HR/Resp 原始訊號（BPM/RPM 填 0，此階段閾值尚未確定）
  var _demoThreshDataTimer = setInterval(() => {
    if (_demoCalibSec >= tc) { clearInterval(_demoThreshDataTimer); return; }
    var t = (_demoCalibSec + Math.random()).toFixed(3);
    var gsr  = Math.round(1800 + (Math.random()-.5)*40);
    var hr   = Math.round(2000 + (Math.random()-.5)*200);  // 較大範圍讓閾值更有意義
    var resp = Math.round(1500 + (Math.random()-.5)*150);
    ingestPacket('DATA,'+t+','+gsr+','+hr+','+resp+',0.0,0.0,0.0');
  }, 50);

  _demoCalibInterval = setInterval(() => {
    _demoCalibSec++;
    ingestPacket('THRESH_PROG,' + _demoCalibSec + ',' + tc);

    if (_demoCalibSec >= tc) {
      clearInterval(_demoCalibInterval);
      // 模擬 THRESH_DONE（HR 中點 ~2000，Resp 中點 ~1500）
      ingestPacket('THRESH_DONE,1978,1503');
      // 延遲 200ms 後啟動 Phase 2
      setTimeout(() => {
        ingestPacket('STATUS,CALIBRATING');
        _demoStartCalib();
      }, 200);
    }
  }, 1000);
}

// Phase 2 Demo：基準值採集（不再呼叫 STATUS,CALIBRATING，由 _demoStartThreshCalib 觸發）
function _demoStartCalib() {
  _demoCalibSec = 0;
  clearInterval(_demoCalibInterval);

  var _demoCalibDataTimer = setInterval(() => {
    if (_demoCalibSec >= CFG.calib) { clearInterval(_demoCalibDataTimer); return; }
    var t    = (_demoCalibSec + Math.random()).toFixed(3);
    var gsr  = Math.round(1800 + (Math.random()-.5)*40);
    var hr   = Math.round(2000 + (Math.random()-.5)*40);
    var resp = Math.round(1500 + (Math.random()-.5)*30);
    var bpm  = (72 + (Math.random()-.5)*3).toFixed(1);
    var rpm  = (14 + (Math.random()-.5)*1.5).toFixed(1);
    ingestPacket('DATA,'+t+','+gsr+','+hr+','+resp+','+bpm+','+rpm+',0');
  }, 50);

  _demoCalibInterval = setInterval(() => {
    _demoCalibSec++;
    ingestPacket('CALIB_PROG,' + _demoCalibSec + ',' + CFG.calib);
    if (_demoCalibSec >= CFG.calib) {
      clearInterval(_demoCalibInterval);
      ingestPacket('BASELINE,1800,2000,1500');
    }
  }, 1000);
}

function _demoStartMeasure() {
  _demoTick = 0; _mp.state = 'running'; ingestPacket('STATUS,RUNNING');
  clearInterval(_mp.demoDataTimer);
  _mp.demoDataTimer = setInterval(() => {
    if (_mp.state !== 'running') return;
    _demoTick++;
    const t = (_demoTick*0.05).toFixed(3);
    const stress = (Math.sin(_demoTick*0.015)*0.5+0.5)*60 + Math.random()*20;
    const gsr  = Math.round(1800-stress*2.2+(Math.random()-.5)*30);
    const hr   = Math.round(2000+stress*1.8+(Math.random()-.5)*25);
    const resp = Math.round(1500+stress*1.5+(Math.random()-.5)*20);
    const bpm  = (72+stress*0.35+(Math.random()-.5)*2).toFixed(1);
    const rpm  = (14+stress*0.10+(Math.random()-.5)*1).toFixed(1);
    const score = Math.min(100,Math.max(0,stress+(Math.random()-.5)*8)).toFixed(1);
    ingestPacket(`DATA,${t},${gsr},${hr},${resp},${bpm},${rpm},${score}`);
    mpUpdateStats(parseFloat(bpm), parseFloat(rpm), parseFloat(score));
  }, 50);
}

// ══════════════════════════════════════════════════════════════
// CALIBRATION WAVEFORM MINI-CHARTS（校正期間波形）
// ══════════════════════════════════════════════════════════════
const mpCalibCharts = {};
const MP_CALIB_WIN = 200;

function mpCalibChartsInit() {
  ['hr','gsr','resp'].forEach(key => {
    if (mpCalibCharts[key]) { try { mpCalibCharts[key].destroy(); } catch(e){} delete mpCalibCharts[key]; }
  });
  const mkCalibChart = (id, color) => {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: { datasets: [{ data: [], borderColor: color, borderWidth: 1.2, fill: false, tension: 0.2, pointRadius: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        elements: { point: { radius: 0 } },
        scales: { x: { type: 'linear', display: false }, y: { display: false } },
      },
    });
  };
  mpCalibCharts.hr   = mkCalibChart('mpCalibCanvasHR',   getComputedStyle(document.documentElement).getPropertyValue('--hr').trim()   || '#f2666a');
  mpCalibCharts.gsr  = mkCalibChart('mpCalibCanvasGSR',  getComputedStyle(document.documentElement).getPropertyValue('--gsr').trim()  || '#f0b429');
  mpCalibCharts.resp = mkCalibChart('mpCalibCanvasResp', getComputedStyle(document.documentElement).getPropertyValue('--rr').trim()   || '#3ecf8e');
}

function mpCalibChartsPush(elapsed, hrRaw, gsrRaw, respRaw) {
  const push = (chart, y) => {
    if (!chart) return;
    const data = chart.data.datasets[0].data;
    data.push({ x: elapsed, y });
    if (data.length > MP_CALIB_WIN) data.shift();
    chart.options.scales.x.min = data.length ? data[0].x : 0;
    chart.options.scales.x.max = elapsed + 0.5;
    chart.update('none');
  };
  push(mpCalibCharts.hr,   hrRaw);
  push(mpCalibCharts.gsr,  gsrRaw);
  push(mpCalibCharts.resp, respRaw);
}

// Hook into setPhaseUI — init calib charts for both Phase 1 and Phase 2
const _origCpOnPhaseChange = typeof cpOnPhaseChange === 'function' ? cpOnPhaseChange : null;
window.cpOnPhaseChange = function(newPhase) {
  if (_origCpOnPhaseChange) _origCpOnPhaseChange(newPhase);
  cpOnPhaseChange_mp(newPhase);
};

const _origSetBleUI2 = setBleUI;
window.setBleUI = function(on) {
  _origSetBleUI2(on);
  _mp.mode = on ? 'ble' : (_mp.mode === 'ble' ? 'none' : _mp.mode);
  mpUpdateConn();
};
const _origSetUsbUI2 = setUsbUI;
window.setUsbUI = function(on) {
  _origSetUsbUI2(on);
  _mp.mode = on ? 'usb' : (_mp.mode === 'usb' ? 'none' : _mp.mode);
  mpUpdateConn();
};

// Wire ingestPacket → mpUpdateStats + calib charts
const _origIngest2 = ingestPacket;
window.ingestPacket = function(raw) {
  _origIngest2(raw);
  // Init calib waveform charts on Phase 1 or Phase 2 start
  if (raw.trim().startsWith('STATUS,THRESH_CALIBRATING') || raw.trim().startsWith('STATUS,CALIBRATING')) {
    setTimeout(() => mpCalibChartsInit(), 50);
  }
  // Push to calib waveform charts during both calib phases
  if (raw.trim().startsWith('DATA,') && (S.phase === 'thresh_calibrating' || S.phase === 'calibrating')) {
    const p = raw.trim().split(',');
    if (p.length >= 5) {
      const elapsed = S.calibBuf?.t?.length ? S.calibBuf.t[S.calibBuf.t.length - 1] :
                      (S.startMs ? (Date.now() - S.startMs) / 1000 : 0);
      mpCalibChartsPush(elapsed, parseInt(p[3]), parseInt(p[2]), parseInt(p[4]));
    }
  }
  if (S.score.length > 0) {
    const last    = S.score[S.score.length-1];
    const lastHr  = S.hr[S.hr.length-1] || {};
    const lastResp= S.resp[S.resp.length-1] || {};
    mpUpdateStats(lastHr.bpm || 0, lastResp.rpm || 0, last.val || 0);
  }
};

mpUpdateConn(); mpUpdate();

// ══════════════════════════════════════════════════════════════
// MASTER PANEL MINIMIZE / COLLAPSE + DRAG
// ══════════════════════════════════════════════════════════════
(function() {
  const panel  = document.getElementById('masterPanel');
  const togBtn = document.getElementById('mpToggleBtn');
  if (!panel || !togBtn) return;

  togBtn.addEventListener('click', e => {
    e.stopPropagation();
    const collapsed = panel.classList.toggle('mp-collapsed');
    togBtn.textContent = collapsed ? '▼' : '▲';
    togBtn.title = collapsed ? '展開面板' : '收合面板';
  });

  let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;
  function panelLeft()  { return panel.getBoundingClientRect().left; }
  function panelTop()   { return panel.getBoundingClientRect().top; }
  function onDragStart(cx, cy) {
    if (panel.classList.contains('mp-maximized')) return;
    dragging = true; startX = cx; startY = cy;
    origLeft = panelLeft(); origTop = panelTop();
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left  = origLeft + 'px'; panel.style.top = origTop + 'px';
  }
  function onDragMove(cx, cy) {
    if (!dragging) return;
    panel.style.left = (origLeft + cx - startX) + 'px';
    panel.style.top  = (origTop  + cy - startY) + 'px';
  }
  function onDragEnd() { dragging = false; }

  const mpHead = document.getElementById('mpHead');
  if (mpHead) {
    mpHead.addEventListener('mousedown',   e  => onDragStart(e.clientX, e.clientY));
    document.addEventListener('mousemove', e  => onDragMove(e.clientX, e.clientY));
    document.addEventListener('mouseup',   () => onDragEnd());
    mpHead.addEventListener('touchstart',  e  => { const t=e.touches[0]; onDragStart(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener('touchmove', e  => { const t=e.touches[0]; onDragMove(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener('touchend',  () => onDragEnd());
  }
})();

// ══════════════════════════════════════════════════════════════
// MASTER PANEL MAXIMIZE
// ══════════════════════════════════════════════════════════════
const mpMiniCharts = {};
const MP_WIN = 120;
const mpMiniCfg = {
  responsive: true, maintainAspectRatio: false, animation: false,
  plugins: { legend: { display: false } },
  elements: { point: { radius: 0 } },
  scales: {
    x: { type: 'linear', grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#454d66', font: { size: 8, family: 'IBM Plex Mono' }, maxTicksLimit: 6, stepSize: 1, callback: v => (Math.abs(v - Math.round(v)) < 0.001) ? Math.round(v) : null } },
    y: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#454d66', font: { size: 8, family: 'IBM Plex Mono' }, maxTicksLimit: 4 } },
  },
};

function mpMiniChartsInit() {
  if (mpMiniCharts.hr) return;
  const mkMini = (id, color) => {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: { datasets: [{ data: [], borderColor: color, borderWidth: 1.5, fill: false, tension: 0.25, pointRadius: 0 }] },
      options: JSON.parse(JSON.stringify(mpMiniCfg)),
    });
  };
  mpMiniCharts.hr   = mkMini('mpCanvasHR',   '#f2666a');
  mpMiniCharts.gsr  = mkMini('mpCanvasGSR',  '#f0b429');
  mpMiniCharts.resp = mkMini('mpCanvasResp', '#3ecf8e');
}

function mpMiniChartsPush() {
  if (!mpMiniCharts.hr) return;
  const slice = arr => arr.slice(-MP_WIN);
  const toXY  = (arr, key) => arr.map(p => ({ x: p.t, y: p[key] }));
  const hrPts   = toXY(slice(S.hr),   'raw');
  const gsrPts  = toXY(slice(S.gsr),  'raw');
  const respPts = toXY(slice(S.resp), 'raw');
  if (mpMiniCharts.hr   && hrPts.length)   { mpMiniCharts.hr.data.datasets[0].data   = hrPts;   mpMiniCharts.hr.update('none'); }
  if (mpMiniCharts.gsr  && gsrPts.length)  { mpMiniCharts.gsr.data.datasets[0].data  = gsrPts;  mpMiniCharts.gsr.update('none'); }
  if (mpMiniCharts.resp && respPts.length) { mpMiniCharts.resp.data.datasets[0].data = respPts; mpMiniCharts.resp.update('none'); }
}

(function() {
  const panel  = document.getElementById('masterPanel');
  const maxBtn = document.getElementById('mpMaxBtn');
  const togBtn = document.getElementById('mpToggleBtn');
  if (!panel || !maxBtn) return;

  let maximized = false;
  maxBtn.addEventListener('click', e => {
    e.stopPropagation();
    maximized = !maximized;
    panel.classList.toggle('mp-maximized', maximized);
    if (maximized) {
      panel.classList.remove('mp-collapsed');
      maxBtn.textContent = '⤡'; maxBtn.title = '還原';
      togBtn.textContent = '▼';
      mpMiniChartsInit();
      setTimeout(() => { mpMiniChartsPush(); Object.values(mpMiniCharts).forEach(c => c && c.resize()); }, 50);
    } else {
      maxBtn.textContent = '⤢'; maxBtn.title = '最大化';
      togBtn.style.display = '';
    }
  });
})();

const _origMpUpdateStats = mpUpdateStats;
window.mpUpdateStats = function(bpm, rpm, score) {
  _origMpUpdateStats(bpm, rpm, score);
  if (document.getElementById('masterPanel')?.classList.contains('mp-maximized')) mpMiniChartsPush();
};

// ══════════════════════════════════════════════════════════════
// MOBILE HAMBURGER / SIDEBAR TOGGLE
// ══════════════════════════════════════════════════════════════
(function() {
  const menuBtn  = document.getElementById('mobileMenuBtn');
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!menuBtn || !sidebar) return;
  function openSidebar()  { sidebar.classList.add('mobile-open');    backdrop.classList.add('show');    menuBtn.textContent = '✕'; }
  function closeSidebar() { sidebar.classList.remove('mobile-open'); backdrop.classList.remove('show'); menuBtn.textContent = '☰'; }
  menuBtn.addEventListener('click', () => sidebar.classList.contains('mobile-open') ? closeSidebar() : openSidebar());
  backdrop.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
  });
})();

// ══════════════════════════════════════════════════════════════
// MOBILE BOTTOM NAV
// ══════════════════════════════════════════════════════════════
(function() {
  const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
  mobileNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pg = btn.dataset.page;
      const sidebarBtn = document.querySelector(`.nav-item[data-page="${pg}"]`);
      if (sidebarBtn) sidebarBtn.click();
    });
  });
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const pg = btn.dataset.page;
      mobileNavBtns.forEach(b => b.classList.toggle('active', b.dataset.page === pg));
    });
  });
})();
