// Timer, phase UI, BTN handling, page switching
// v12.4 — 新增 thresh_calibrating 階段支援

// ============================================================
// TIMER
// ============================================================
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function startTimer() {
  function tick() {
    if (S.startMs) document.getElementById('mainTimer').textContent = fmt(Date.now() - S.startMs);
    S.timerRaf = requestAnimationFrame(tick);
  }
  cancelAnimationFrame(S.timerRaf);
  S.timerRaf = requestAnimationFrame(tick);
}

// ============================================================
// STATUS BANNER
// ============================================================
function setPhaseUI(phase, customText) {
  S.phase = phase;
  const badge  = document.getElementById('phaseBadge');
  const dot    = document.getElementById('statusDot');
  const main   = document.getElementById('statusMainText');
  const sub    = document.getElementById('statusSubText');
  const banner = document.getElementById('statusBanner');
  const timer  = document.getElementById('mainTimer');
  const ptext  = document.getElementById('phaseText');

  badge.className = 'phase-badge';
  timer.className = 'timer-value';

  const _isEN = typeof _lang !== 'undefined' && _lang === 'en';
  const cfg = {
    idle: {
      badgeCls: 'ph-idle',   badgeTxt: 'IDLE',
      dotColor: '#454d66',   bannerBorder: 'var(--line)',
      main: _isEN ? 'Idle — awaiting ESP32 operation' : '閒置中 — 等待 ESP32 操作',
      sub:  '',
      timerCls: '',
    },
    // ★ Phase 1 — 動態閾值校正
    thresh_calibrating: {
      badgeCls: 'ph-calib',  badgeTxt: 'THRESH CAL',
      dotColor: '#9b7fe8',   bannerBorder: 'rgba(155,127,232,.35)',
      main: _isEN
        ? 'Phase 1 — Measuring HR & Resp dynamic thresholds'
        : '第一階段 — 偵測心率 & 呼吸動態閾值',
      sub: _isEN
        ? `Collecting signal range for peak detection (${CFG.thresh_calib}s)`
        : `採集峰值偵測訊號範圍（${CFG.thresh_calib} 秒），完成後自動進入基準值採集`,
      timerCls: 'cal',
    },
    // Phase 2 — 基準值採集
    calibrating: {
      badgeCls: 'ph-calib',  badgeTxt: 'CALIBRATING',
      dotColor: '#f0b429',   bannerBorder: 'rgba(240,180,41,.35)',
      main: _isEN
        ? 'Phase 2 — Collecting resting baseline (BPM / RPM / GSR)'
        : '第二階段 — 採集靜息基準值（BPM / RPM / GSR）',
      sub: _isEN
        ? 'Baseline ready → press Start Measurement'
        : '校正完成後自動解鎖「開始量測」',
      timerCls: 'cal',
    },
    waiting_for_start: {
      badgeCls: 'ph-paused', badgeTxt: 'READY',
      dotColor: '#9b7fe8',   bannerBorder: 'rgba(155,127,232,.5)',
      main: _isEN ? 'Baseline ready — press Start Measurement' : '基準值採集完成 — 按「開始量測」',
      sub:  '',
      timerCls: '',
    },
    running: {
      badgeCls: 'ph-run',    badgeTxt: 'RUNNING',
      dotColor: '#f2666a',   bannerBorder: 'rgba(242,102,106,.35)',
      main: _isEN ? 'Measuring — receiving biometric data' : '量測中 — 正在接收生理數據',
      sub:  '',
      timerCls: 'rec',
    },
    paused: {
      badgeCls: 'ph-paused', badgeTxt: 'PAUSED',
      dotColor: '#9b7fe8',   bannerBorder: 'rgba(155,127,232,.35)',
      main: _isEN ? 'Paused — data reception paused' : '暫停中 — 數據接收暫停',
      sub:  '',
      timerCls: '',
    },
    ended: {
      badgeCls: 'ph-idle',   badgeTxt: 'ENDED',
      dotColor: '#3ecf8e',   bannerBorder: 'rgba(62,207,142,.25)',
      main: _isEN ? 'Session complete' : '量測完成',
      sub:  _isEN ? 'Redirecting to Data Center...' : '即將跳轉數據中心...',
      timerCls: '',
    },
  };

  const c = cfg[phase] || cfg.idle;
  badge.classList.add(c.badgeCls);
  badge.textContent = c.badgeTxt;
  dot.style.background = c.dotColor;
  dot.style.boxShadow  = `0 0 8px ${c.dotColor}`;
  banner.style.borderColor = c.bannerBorder;
  main.textContent = customText || c.main;
  sub.textContent  = c.sub;
  if (c.timerCls) timer.classList.add(c.timerCls);
  if (ptext) ptext.textContent = c.main;
  document.getElementById('calibTime').textContent = CFG.calib + 's';

  // ★ 校正基準值面板 — thresh_calibrating 和 calibrating 都顯示
  const calibStatsEl = document.getElementById('mpCalibStats');
  const calibLiveEl  = document.getElementById('mpCalibLive');
  const baseResultEl = document.getElementById('mpBaseResult');
  if (calibStatsEl) {
    const showPanel = (phase === 'thresh_calibrating' || phase === 'calibrating' || phase === 'waiting_for_start');
    calibStatsEl.style.display = showPanel ? 'block' : 'none';
    if (showPanel) {
      if (phase === 'thresh_calibrating') {
        calibStatsEl.style.background = 'rgba(155,127,232,.06)';
        calibStatsEl.style.border     = '1px solid rgba(155,127,232,.3)';
      } else if (phase === 'calibrating') {
        calibStatsEl.style.background = 'rgba(240,180,41,.06)';
        calibStatsEl.style.border     = '1px solid rgba(240,180,41,.3)';
      } else {
        calibStatsEl.style.background = 'rgba(62,207,142,.06)';
        calibStatsEl.style.border     = '1px solid rgba(62,207,142,.25)';
      }
    }
    if (calibLiveEl)  calibLiveEl.style.display  = (phase === 'thresh_calibrating' || phase === 'calibrating') ? 'block' : 'none';
    if (baseResultEl) baseResultEl.style.display = (phase === 'waiting_for_start') ? 'block' : 'none';
    if (phase === 'running' || phase === 'paused' || phase === 'idle' || phase === 'ended') {
      calibStatsEl.style.display = 'none';
      const mpSc = document.getElementById('mpScore');
      if (mpSc && mpSc.textContent === '校正中') mpSc.textContent = '--';
    }
  }

  if (typeof cpOnPhaseChange === 'function') cpOnPhaseChange(phase);

  const isActive = (phase === 'running' || phase === 'paused');
  document.getElementById('btnStop').classList.toggle('hidden', !isActive);
  document.getElementById('btnPause').classList.toggle('hidden', !isActive);
  if (phase === 'paused') {
    document.getElementById('btnPause').textContent = '繼續接收';
  } else {
    document.getElementById('btnPause').textContent = '暫停接收';
  }
}

// ============================================================
// CONTROL BUTTONS
// ============================================================
document.getElementById('btnStop').addEventListener('click', () => {
  if (S.connMode) deviceWrite('STOP');
  else stopDemo();
});

document.getElementById('btnPause').addEventListener('click', () => {
  if (S.phase === 'running') {
    if (S.connMode) deviceWrite('PAUSE');
    if (S.connMode === 'usb') setPhaseUI('paused');
  } else if (S.phase === 'paused') {
    if (S.connMode) deviceWrite('RESUME');
    if (S.connMode === 'usb') setPhaseUI('running');
  }
});

document.getElementById('btnExportCsv').addEventListener('click', exportCsv);

document.getElementById('btnDemo').addEventListener('click', () => {
  document.getElementById('demoPanel').classList.toggle('hidden');
  document.getElementById('dpCalibSec').textContent = CFG.calib;
});

function enterRunning() {
  if (S.phase === 'waiting_for_start' || S.phase === 'idle') {
    S.hr = []; S.gsr = []; S.resp = []; S.score = []; rrDetectReset(); hrDetectReset();
    S.gsrTriggers = 0; S.gsrConsec = 0;
    S._lastChartT = -999;
    S.startMs = Date.now();
    startTimer();
  } else {
    if (!S.startMs) S.startMs = Date.now();
    startTimer();
  }

  if (liveCharts.overview) {
    liveCharts.overview.data.datasets.forEach(ds => { ds.data = []; });
    liveCharts.overview.options.scales.x.min = undefined;
    liveCharts.overview.options.scales.x.max = undefined;
    liveCharts.overview.update('none');
  }
  _overviewAvgCtr = 0;

  ;['hr','gsr','resp'].forEach(key => {
    const chart = liveCharts[key];
    if (!chart) return;
    chart.data.datasets.forEach(ds => { ds.data = []; });
    chart.options.scales.x.min = undefined;
    chart.options.scales.x.max = undefined;
    chart.update('none');
  });
  ;['bpm','rpm'].forEach(key => {
    const chart = liveCharts[key];
    if (!chart) return;
    chart.data.datasets.forEach(ds => { ds.data = []; });
    chart.options.scales.x.min = undefined;
    chart.options.scales.x.max = undefined;
    chart.update('none');
  });

  setPhaseUI('running');
}

function handleEnd() {
  cancelAnimationFrame(S.timerRaf);
  setPhaseUI('ended');
  document.getElementById('btnDemo').textContent = 'Demo';
  setTimeout(() => switchPage('analysis'), 800);
}

function switchPage(pg) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-page="${pg}"]`).classList.add('active');
  document.getElementById('page-' + pg).classList.add('active');
  if (pg === 'analysis') refreshAnalysis();
}
