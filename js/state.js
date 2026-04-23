// Application state
// Source: biomonitor_v26.html lines 1824-1855

// ============================================================
// STATE
// ============================================================
const S = {
  phase: 'idle',   // idle | calibrating | running | paused | ended
  startMs: null,
  calibEndSec: null,   // 校正區間結束秒數（用於畫背景）
  bleDevice: null, bleChar: null, connected: false,
  timerRaf: null,

  // 數據 — 只存 RUNNING 期間的點（不含校正）
  hr:   [],  // {t, raw, bpm}
  gsr:  [],  // {t, raw}
  resp: [],  // {t, raw, rpm}
  score:[],  // {t, val}

  // 基準值（來自 ESP32 BASELINE 封包）
  base: { hr: null, gsr: null, resp: null },

  gsrTriggers: 0,
  gsrConsec: 0,

  // 連線模式：null | 'ble' | 'usb'
  connMode: null,

  // ★ 動態閾值（Phase 1 結果）
  threshHR: null,
  threshResp: null,

  // 比較頁數據集
  compareSets: [],

};

// ============================================================
// NAVIGATION
