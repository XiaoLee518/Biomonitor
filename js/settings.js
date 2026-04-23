// Settings page logic & i18n
// Source: biomonitor_v26.html lines 3959-4186

// ============================================================
// ============================================================
// LANGUAGE TOGGLE — comprehensive i18n
// ============================================================
let _lang = 'zh';

const I18N = {
  zh: {
    // Sidebar nav
    nav_stress: '壓力監測', nav_analysis: '數據中心',
    nav_manual: '實驗手冊', nav_settings: '參數設定',
    // Page titles
    pt_stress: '壓力監測 / Live', pt_analysis: '數據中心 / Analysis',
    pt_manual: '實驗手冊 / Manual', pt_settings: '參數設定 / Settings',
    // Stress page
    lbl_elapsed: 'elapsed', lbl_phase: 'phase', lbl_datapoints: 'data points',
    lbl_samplerate: 'sample rate', lbl_calibtime: 'calib time',
    lbl_waitcalib: '等待校正...',
    lbl_overview: '綜合原始數據',
    lbl_calib_region: '校正區間',
    lbl_stress_title: '當前緊張指數（由 ESP32 計算）',
    lbl_rawlog: '原始數據紀錄',
    // Sub-tabs
    tab_summary: '概覽', tab_advanced: '進階分析',
    tab_compare: '數據比較', tab_report: '報告',
    tab_playback: '回放', tab_detail_charts: '詳細圖表', tab_export_center: '匯出中心',
    // Analysis
    lbl_baseline_title: '靜息基準值（由 ESP32 校正後傳送）',
    lbl_stress_full: '全程緊張指數 / Full-Session Stress Index',
    lbl_stress_src: '來源：ESP32 即時計算值 | 紅虛線 = 緊張閾值 60',
    lbl_anomaly: '異常區間偵測',
    lbl_no_data: '尚無數據。請先進行測量，或匯入 CSV 檔案。',
    // Settings
    btn_save: '儲存並同步 ESP32',
    sh_weights: '壓力指數權重（自動正規化為總和 1.00）',
    sh_hr: '心率參數', sh_resp: '呼吸參數',
    sh_gsr: 'GSR 參數', sh_sys: '系統參數',
    sh_rate: '封包傳入速率', sh_preview: '緊張判定閾值預覽',
    // Metric cards
    mc_hr: 'Heart Rate', mc_gsr: 'GSR', mc_resp: 'Respiration',
    mc_cur_bpm: 'current BPM', mc_base_avg: 'baseline avg',
    mc_cur_rpm: 'current RPM',
    // Buttons
    btn_print: '列印 / 儲存 PDF',
    // Master panel
    mp_start_calib: '開始校正', mp_stop_calib: '中止校正',
    mp_start_meas: '開始量測', mp_pause: '暫停量測',
    mp_resume: '繼續量測', mp_stop: '停止',
    mp_waiting: '等待開始', mp_calib_timing: '校正計時',
    mp_wait_start: '等待開始量測', mp_meas_timing: '量測計時',
    mp_paused_lbl: '暫停中',
    // Playback
    pb_title: '影片回放 — 緊張時段對應',
    pb_dl_video: '下載全段影片',
    pb_dl_clips: '下載緊張片段',
    pb_dl_session: '下載當次完整資料',
    pb_close: '✕ 關閉',
    pb_timeline_hint: '緊張事件時間軸 — 點擊紅色標記跳轉至對應時段',
    pb_events_hint: '緊張事件（Score ≥ 60）— 點擊直接跳轉：',
    pb_no_events: '無緊張事件',
    pb_offset_hint: '影片從量測開始的時刻對齊緊張指數時間軸。若錄影比量測更早開始，系統已自動計算偏移量。',
    // Connection
    ble_connected: 'BLE 已連線', ble_disconnected: 'BLE 未連線',
    usb_connected: 'USB 已連線', usb_disconnected: 'USB 未連線',
    // Status phases
    status_idle: '閒置中 — 等待 ESP32 操作',
    status_calib: '校正中 — ESP32 正在採集靜息基準值',
    status_wait_start: '基準值採集完成 — 按 BTN2 開始量測',
    status_running: '量測中 — 正在接收生理數據',
    status_paused: '暫停中 — 數據接收暫停',
    status_ended: '量測完成',
    // Camera
    cam_recording: '錄製中', cam_has_rec: '有錄影', cam_no_rec: '未錄製',
    cam_btn_stop: '停止錄製', cam_btn_view: '查看回放', cam_btn_start: '鏡頭',
  },
  en: {
    nav_stress: 'Live Monitor', nav_analysis: 'Data Center',
    nav_manual: 'Manual', nav_settings: 'Settings',
    pt_stress: 'Live Monitor', pt_analysis: 'Data Center',
    pt_manual: 'Manual', pt_settings: 'Settings',
    lbl_elapsed: 'elapsed', lbl_phase: 'phase', lbl_datapoints: 'data points',
    lbl_samplerate: 'sample rate', lbl_calibtime: 'calib time',
    lbl_waitcalib: 'Waiting for calibration...',
    lbl_overview: 'Combined Raw Data',
    lbl_calib_region: 'Calib Region',
    lbl_stress_title: 'Current Stress Index (computed by ESP32)',
    lbl_rawlog: 'Raw Data Log',
    tab_summary: 'Summary', tab_advanced: 'Advanced',
    tab_compare: 'Compare', tab_report: 'Report',
    tab_playback: 'Playback', tab_detail_charts: 'Charts', tab_export_center: 'Export',
    lbl_baseline_title: 'Resting Baseline (from ESP32 calibration)',
    lbl_stress_full: 'Full-Session Stress Index',
    lbl_stress_src: 'Source: ESP32 real-time | Red dashed = threshold 60',
    lbl_anomaly: 'Anomaly Detection',
    lbl_no_data: 'No data yet. Start a measurement session first.',
    btn_save: 'Save & Sync ESP32',
    sh_weights: 'Stress Index Weights (auto-normalized to 1.00)',
    sh_hr: 'Heart Rate Params', sh_resp: 'Respiration Params',
    sh_gsr: 'GSR Params', sh_sys: 'System Params',
    sh_rate: 'Packet Rate', sh_preview: 'Stress Threshold Preview',
    mc_hr: 'Heart Rate', mc_gsr: 'GSR', mc_resp: 'Respiration',
    mc_cur_bpm: 'current BPM', mc_base_avg: 'baseline avg',
    mc_cur_rpm: 'current RPM',
    btn_print: 'Print / Save PDF',
    mp_start_calib: 'Start Calibration', mp_stop_calib: 'Abort Calibration',
    mp_start_meas: 'Start Measurement', mp_pause: 'Pause',
    mp_resume: 'Resume', mp_stop: '  Stop',
    mp_waiting: 'Waiting', mp_calib_timing: 'Calibrating',
    mp_wait_start: 'Ready to measure', mp_meas_timing: 'Measuring',
    mp_paused_lbl: 'Paused',
    pb_title: 'Video Playback — Stress Segments',
    pb_dl_video: 'Download Full Video',
    pb_dl_clips: 'Download Stress Clips',
    pb_dl_session: 'Download Full Session Data',
    pb_close: '✕ Close',
    pb_timeline_hint: 'Stress timeline — click red markers to jump',
    pb_events_hint: 'Stress events (Score ≥ 60) — click to jump:',
    pb_no_events: 'No stress events',
    pb_offset_hint: 'Video aligns to measurement start. Offset is auto-calculated if recording started earlier.',
    ble_connected: 'BLE Connected', ble_disconnected: 'BLE Disconnected',
    usb_connected: 'USB Connected', usb_disconnected: 'USB Disconnected',
    status_idle: 'Idle — awaiting ESP32 operation',
    status_calib: 'Calibrating — collecting baseline',
    status_wait_start: 'Baseline ready — press BTN2 to start',
    status_running: 'Recording — receiving biometric data',
    status_paused: 'Paused — data reception paused',
    status_ended: 'Session complete',
    cam_recording: 'Recording', cam_has_rec: 'Has recording', cam_no_rec: 'No recording',
    cam_btn_stop: 'Stop Recording', cam_btn_view: 'View Playback', cam_btn_start: 'Camera',
  }
};

function t(key) { return (I18N[_lang] || I18N.zh)[key] || key; }

function applyLang() {
  const L = _lang;
  // data-zh / data-en attributes (generic)
  document.querySelectorAll('[data-zh]').forEach(el => {
    el.textContent = L === 'en' ? (el.dataset.en || el.dataset.zh) : el.dataset.zh;
  });
  // Nav items
  const navMap = { stress:'nav_stress', analysis:'nav_analysis', manual:'nav_manual', settings:'nav_settings' };
  document.querySelectorAll('.nav-item').forEach(btn => {
    const k = navMap[btn.dataset.page]; if(k) btn.textContent = t(k);
  });
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const k = navMap[btn.dataset.page]; if(k) btn.textContent = t(k);
  });
  // Page titles
  const ptMap = { 'page-stress': 'pt_stress', 'page-analysis': 'pt_analysis', 'page-manual': 'pt_manual', 'page-settings': 'pt_settings' };
  Object.entries(ptMap).forEach(([pgId, k]) => {
    const el = document.querySelector(`#${pgId} .page-title`); if(el) el.textContent = t(k);
  });
  // Sub-tabs
  const stMap = { summary:'tab_summary', advanced:'tab_advanced', compare:'tab_compare', report:'tab_report', playback:'tab_playback', 'detail-charts':'tab_detail_charts', 'export-center':'tab_export_center' };
  document.querySelectorAll('.sub-tab').forEach(btn => {
    const k = stMap[btn.dataset.subtab]; if(k) btn.textContent = t(k);
  });
  // Timer labels
  const timerLabelMap = { elapsed:'lbl_elapsed', phase:'lbl_phase', 'data points':'lbl_datapoints', 'sample rate':'lbl_samplerate', 'calib time':'lbl_calibtime' };
  document.querySelectorAll('.timer-label').forEach(el => {
    const k = timerLabelMap[el.textContent.trim()]; if(k) el.textContent = t(k);
  });
  // Phase text
  const phaseEl = document.getElementById('phaseText');
  if(phaseEl && (phaseEl.textContent.includes('等待') || phaseEl.textContent.includes('Waiting'))) {
    phaseEl.textContent = t('lbl_waitcalib');
  }
  // Overview chart title
  const ovEl = document.querySelector('#page-stress .chart-title');
  if(ovEl) ovEl.textContent = t('lbl_overview');
  // Calib region legend
  document.querySelectorAll('.leg').forEach(el => {
    if(el.textContent.includes('校正區間') || el.textContent.includes('Calib')) {
      const dot = el.querySelector('.leg-dot'); const txt = t('lbl_calib_region');
      el.textContent = ''; if(dot) { el.appendChild(dot); } el.append(' ' + txt);
    }
  });
  // Stress gauge title
  const sgEl = document.querySelector('.gauge-wrap .chart-title');
  if(sgEl) sgEl.textContent = t('lbl_stress_title');
  // Metric card names
  document.querySelectorAll('.metric-name[style*="--hr"]').forEach(el => el.textContent = t('mc_hr'));
  document.querySelectorAll('.metric-name[style*="--gsr"]').forEach(el => el.textContent = t('mc_gsr'));
  document.querySelectorAll('.metric-name[style*="--rr"]').forEach(el => el.textContent = t('mc_resp'));
  // Raw log title
  const logTitle = document.querySelector('.metric-head .metric-name');
  if(logTitle && (logTitle.textContent === '原始數據紀錄' || logTitle.textContent === 'Raw Data Log')) {
    logTitle.textContent = t('lbl_rawlog');
  }
  // Analysis empty text
  const anaEmpty = document.getElementById('anaEmpty');
  if(anaEmpty) anaEmpty.textContent = t('lbl_no_data');
  // Settings save button
  const btnSave = document.getElementById('btnSave');
  if(btnSave && !btnSave.textContent.includes('已儲存') && !btnSave.textContent.includes('Saved')) {
    btnSave.textContent = t('btn_save');
  }
  // Print button
  const btnPrint = document.getElementById('btnPrintReport');
  if(btnPrint) btnPrint.textContent = t('btn_print');
  // Playback modal
  const pbTitle = document.querySelector('#playbackModal .modal-title');
  if(pbTitle) pbTitle.textContent = t('pb_title');
  const btnPbClose = document.getElementById('btnPlaybackClose');
  if(btnPbClose) btnPbClose.textContent = t('pb_close');
  const btnDlVideo = document.getElementById('btnExportVideo');
  if(btnDlVideo) btnDlVideo.textContent = t('pb_dl_video');
  const btnDlClips = document.getElementById('btnDownloadClips');
  if(btnDlClips) btnDlClips.textContent = t('pb_dl_clips');
  const btnDlSession = document.getElementById('btnDownloadSession');
  if(btnDlSession) btnDlSession.textContent = t('pb_dl_session');
  // BLE/USB status
  const bleTxt = document.getElementById('bleText');
  if(bleTxt) { const on = document.getElementById('bleDot')?.classList.contains('on'); bleTxt.textContent = on ? t('ble_connected') : t('ble_disconnected'); }
  const usbTxt = document.getElementById('usbText');
  if(usbTxt) { const on = document.getElementById('usbDot')?.classList.contains('on'); usbTxt.textContent = on ? t('usb_connected') : t('usb_disconnected'); }
  // Master panel timer sub-labels
  mpUpdate();
  // Camera button
  camUpdateUI();
}

document.getElementById('btnLang').addEventListener('click', () => {
  _lang = _lang === 'zh' ? 'en' : 'zh';
  document.getElementById('btnLang').textContent = _lang === 'zh' ? 'EN' : '中文';
  applyLang();
});

// ANALYSIS PAGE
