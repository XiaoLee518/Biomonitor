// Packet ingestion & baseline UI
// v12.4 — 支援兩階段校正：THRESH_CALIBRATING (Phase 1) + CALIBRATING (Phase 2)

function ingestPacket(raw) {
  const line = raw.trim();

  // ── ★ THRESH 進度封包（Phase 1）──────────────────────────
  if (line.startsWith('THRESH_PROG,')) {
    const p = line.split(',');
    const elapsed = parseInt(p[1]);
    const total   = parseInt(p[2]);
    const pct = total > 0 ? Math.min(100, elapsed / total * 100) : 0;
    // ★ 真實模式下由 THRESH_PROG 驅動進度條（Demo 模式進度條由 master-panel 計時器控制）
    if (typeof _mp !== 'undefined' && _mp.mode !== 'demo') {
      const f = document.getElementById('mpCalibFill');
      if (f) f.style.width = pct + '%';
    }
    if (typeof _mp !== 'undefined') { _mp.threshSec = elapsed; mpUpdate(); }
    return;
  }

  // ── ★ THRESH 完成封包（Phase 1 → 自動切換 Phase 2）──────
  if (line.startsWith('THRESH_DONE,')) {
    const p = line.split(',');
    const hrT   = parseInt(p[1]);
    const respT = parseInt(p[2]);
    // 儲存到 S 供 UI 顯示
    S.threshHR   = hrT;
    S.threshResp = respT;
    // 在主控面板顯示閾值結果（如果 DOM 元素存在）
    const el = document.getElementById('mpThreshResult');
    if (el) el.textContent = `HR 閾值: ${hrT}  ·  Resp 閾值: ${respT}`;
    // 重置進度條，準備 Phase 2
    const f = document.getElementById('mpCalibFill');
    if (f) f.style.width = '0%';
    // 通知 master-panel 切換至 calib 計時器
    if (typeof _mpOnThreshDone === 'function') _mpOnThreshDone();
    return;
  }

  // ── CALIB 進度封包（Phase 2）─────────────────────────────
  if (line.startsWith('CALIB_PROG,')) {
    const p = line.split(',');
    const pct = parseInt(p[2]) > 0 ? Math.min(100, parseInt(p[1]) / parseInt(p[2]) * 100) : 0;
    const f = document.getElementById('mpCalibFill');
    if (f) f.style.width = pct + '%';
    if (typeof _mp !== 'undefined') { _mp.calibSec = parseInt(p[1]); mpUpdate(); }
    return;
  }

  // ── BASELINE 封包 ─────────────────────────────────────────
  if (line.startsWith('BASELINE,')) {
    const p = line.split(',');
    S.base.gsr  = parseFloat(p[1]);
    S.base.hr   = parseFloat(p[2]);
    S.base.resp = parseFloat(p[3]);

    // ★ P80 百分位數法計算所有基準值（比中位數更 robust）
    // 過濾生理合理範圍，排序後取第 80 百分位數索引
    const p80 = arr => {
      if (!arr || arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.min(Math.floor(sorted.length * 0.80), sorted.length - 1);
      return sorted[idx];
    };

    if (S.calibBuf) {
      const validBpm  = (S.calibBuf.bpm  || []).filter(v => v != null && v >= 40 && v <= 150);
      const validRpm  = (S.calibBuf.rpm  || []).filter(v => v != null && v >= 3  && v <= 35);
      const validGsr  = (S.calibBuf.gsr  || []).filter(v => v != null && v > 0);
      const validHr   = (S.calibBuf.hr   || []).filter(v => v != null && v > 0);
      const validResp = (S.calibBuf.resp || []).filter(v => v != null && v > 0);

      // BPM：P80（靜息心率取偏高端，過濾假低值）
      if (validBpm.length >= 3) {
        S.base.bpm = p80(validBpm);
      } else if (validBpm.length > 0) {
        S.base.bpm = validBpm.reduce((a, b) => a + b, 0) / validBpm.length;
      } else {
        S.base.bpm = null;
      }

      // RPM：P80（靜息呼吸率同樣取偏高端）
      if (validRpm.length >= 2) {
        S.base.rpm = p80(validRpm);
      } else if (validRpm.length > 0) {
        S.base.rpm = validRpm.reduce((a, b) => a + b, 0) / validRpm.length;
      } else {
        S.base.rpm = null;
      }

      // ★ RPM fallback：即時峰值偵測失敗時，從 calibBuf.resp 原始波形做零點穿越分析
      //   靜息呼吸幅度僅 1–2%，閾值型偵測容易失效；直接分析完整波形更可靠
      if (S.base.rpm == null && (S.calibBuf.resp || []).length >= 60) {
        S.base.rpm = _computeRpmFromRespBuf(S.calibBuf.resp);
      }

      // GSR：P80（取偏高端作為靜息基準，壓力升高時 GSR 下降）
      if (validGsr.length >= 3) {
        S.base.gsr = p80(validGsr);
      } else if (validGsr.length > 0) {
        S.base.gsr = validGsr.reduce((a, b) => a + b, 0) / validGsr.length;
      }

      // HR / Resp 原始 ADC：P80
      if (validHr.length >= 3)   S.base.hr   = p80(validHr);
      if (validResp.length >= 3) S.base.resp = p80(validResp);
    }

    updateBaselineUI();
    _mpShowBaselineResult();
    setPhaseUI('waiting_for_start');
    return;
  }

  // ── STATUS 封包 ──────────────────────────────────────────
  if (line.startsWith('STATUS,')) {
    const status = line.split(',')[1];

    if (status === 'WAITING') {
      cancelAnimationFrame(S.timerRaf);
      document.getElementById('mainTimer').textContent = '00:00';
      setPhaseUI('idle');

    // ── ★ Phase 1：閾值校正開始 ────────────────────────────
    } else if (status === 'THRESH_CALIBRATING') {
      if (typeof _mpCalibInitDone !== 'undefined' && _mpCalibInitDone) {
        // master-panel 已做過完整初始化，只更新 phase UI
        // ★ 修正：必須在此設定 startMs，否則 elapsed 會使用 Unix 時間戳當 X 軸
        _mpCalibInitDone = false;
        S.startMs = Date.now();
        S._lastCalibChartT = -999;
        startTimer();
        setPhaseUI('thresh_calibrating');
      } else {
        // 完整重置（直接從 ESP32 收到 THRESH_CALIBRATING 的情況，例如重連）
        S.hr = []; S.gsr = []; S.resp = []; S.score = [];
        S.calibBuf = null;
        S._lastCalibChartT = -999;
        _overviewAvgCtr = 0;
        hrDetectReset(); rrDetectReset();
        S.base = { hr: null, gsr: null, resp: null, bpm: null, rpm: null };
        S.threshHR = null; S.threshResp = null;
        ;['hr','gsr','resp'].forEach(key => {
          const chart = liveCharts[key];
          if (chart) { chart.data.datasets[0].data = []; chart.data.datasets[1].data = []; chart.data.datasets[2].data = []; chart.update('none'); }
        });
        if (liveCharts.bpm) { liveCharts.bpm.data.datasets[0].data = []; liveCharts.bpm.data.datasets[1].data = []; liveCharts.bpm.update('none'); }
        if (liveCharts.rpm) { liveCharts.rpm.data.datasets[0].data = []; liveCharts.rpm.data.datasets[1].data = []; liveCharts.rpm.update('none'); }
        S.startMs = Date.now();
        startTimer();
        setPhaseUI('thresh_calibrating');
      }

    // ── Phase 2：基準值採集開始 ─────────────────────────────
    } else if (status === 'CALIBRATING') {
      if (S.phase === 'thresh_calibrating') {
        // ★ 剛從 Phase 1 轉入：不做完整重置，只初始化 calibBuf
        //   圖表和陣列已在 thresh 階段清空，繼續沿用
        S.calibBuf = null;
        S._lastCalibChartT = -999;
        // ★ 不重置 S.startMs — Phase 1 開始時已設，時間軸連續
        setPhaseUI('calibrating');
        // cpOnPhaseChange_mp 會被 setPhaseUI 觸發 → 呼叫 _mpStartPhase2Timer
      } else if (typeof _mpCalibInitDone !== 'undefined' && _mpCalibInitDone) {
        _mpCalibInitDone = false;
        setPhaseUI('calibrating');
      } else {
        // 完整重置（直接進入 CALIBRATING，沒有 thresh 前置的情況）
        S.hr = []; S.gsr = []; S.resp = []; S.score = [];
        S.calibBuf = null;
        S._lastCalibChartT = -999;
        _overviewAvgCtr = 0;
        hrDetectReset(); rrDetectReset();
        S.gsrTriggers = 0; S.gsrConsec = 0;
        S.base = { hr: null, gsr: null, resp: null, bpm: null, rpm: null };
        ;['hr','gsr','resp'].forEach(key => {
          const chart = liveCharts[key];
          if (chart) { chart.data.datasets[0].data = []; chart.data.datasets[1].data = []; chart.data.datasets[2].data = []; chart.update('none'); }
        });
        if (liveCharts.bpm) { liveCharts.bpm.data.datasets[0].data = []; liveCharts.bpm.data.datasets[1].data = []; liveCharts.bpm.update('none'); }
        if (liveCharts.rpm) { liveCharts.rpm.data.datasets[0].data = []; liveCharts.rpm.data.datasets[1].data = []; liveCharts.rpm.update('none'); }
        S.startMs = Date.now();
        startTimer();
        setPhaseUI('calibrating');
      }

    } else if (status === 'RUNNING') {
      enterRunning();
    } else if (status === 'WAITING_FOR_START') {
      setPhaseUI('waiting_for_start');
    } else if (status === 'PAUSED') {
      setPhaseUI('paused');
    } else if (status === 'STOPPED') {
      handleEnd();
    }
    return;
  }

  // ── END 封包 ─────────────────────────────────────────────
  if (line === 'END') { handleEnd(); return; }

  // ── DATA 封包 ─────────────────────────────────────────────
  // v5: DATA,sec,gsrRaw,hrRaw,respRaw,BPM,RPM,Score
  // v6: DATA,sec,gsrRaw,hrRaw,respRaw,respOhm,BPM,RPM,Score,RespStatus
  if (line.startsWith('DATA,')) {
    const p = line.split(',');
    if (p.length < 8) return;
    const t      = parseFloat(p[1]);
    const gsrRaw = parseInt(p[2]);
    const hrRaw  = parseInt(p[3]);
    const respRaw = parseInt(p[4]);
    let bpm, rpm;
    if (p.length >= 10) {
      bpm = parseFloat(p[6]); rpm = parseFloat(p[7]);
    } else {
      bpm = parseFloat(p[5]); rpm = parseFloat(p[6]);
    }
    if (isNaN(t)) return;

    // 前端備援偵測（ESP32 送 0 時用前端演算法補值）
    const feBPM = hrDetectPush(t, hrRaw);
    const feRPM = rrDetectPush(t, respRaw);
    if (!(bpm > 0) && feBPM > 0) bpm = feBPM;
    if (!(rpm > 0) && feRPM > 0) rpm = feRPM;

    // ── ★ Phase 1 (thresh_calibrating)：顯示波形但不記入 calibBuf ──
    if (S.phase === 'thresh_calibrating') {
      const elapsed = (Date.now() - S.startMs) / 1000;
      const ci = 1 / (CFG.chart_rate || 10);
      if (elapsed - (S._lastCalibChartT || -999) >= ci) {
        S._lastCalibChartT = elapsed;
        // 推入即時波形（dataset[0]）供觀察；不寫 dataset[2]（校正參考線）
        ;['hr','gsr','resp'].forEach((key, i) => {
          const chart = liveCharts[key];
          if (!chart) return;
          const val = [hrRaw, gsrRaw, respRaw][i];
          pushPt(chart.data.datasets[0].data, { x: elapsed, y: val });
          chart.options.scales.x.min = 0;
          chart.options.scales.x.max = Math.max(CFG.thresh_calib, elapsed + 2);
          chart.update('none');
        });
      }
      // 更新主控面板 ADC 即時顯示
      const ss2 = (id, v, d) => { const el = document.getElementById(id); if (el) el.textContent = v != null ? v.toFixed(d) : '--'; };
      ss2('mpCalibHR',   hrRaw,   0);
      ss2('mpCalibGSR',  gsrRaw,  0);
      ss2('mpCalibResp', respRaw, 0);
      // 推入 miniCalib charts（供 master panel 顯示）
      if (typeof mpCalibChartsPush === 'function') mpCalibChartsPush(elapsed, hrRaw, gsrRaw, respRaw);
      updateOverview(elapsed, hrRaw, gsrRaw, respRaw);
      return;
    }

    // ── Phase 2 (calibrating)：累積至 calibBuf ───────────────
    if (S.phase === 'calibrating') {
      const elapsed = (Date.now() - S.startMs) / 1000;

      if (!S.calibBuf) S.calibBuf = { hr: [], gsr: [], resp: [], bpm: [], rpm: [], t: [] };
      S.calibBuf.t.push(+elapsed.toFixed(3));
      S.calibBuf.hr.push(hrRaw);
      S.calibBuf.gsr.push(gsrRaw);
      S.calibBuf.resp.push(respRaw);
      S.calibBuf.bpm.push(bpm > 0 ? bpm : null);
      S.calibBuf.rpm.push(rpm > 0 ? rpm : null);

      const ci = 1 / (CFG.chart_rate || 10);
      if (elapsed - (S._lastCalibChartT || -999) >= ci) {
        S._lastCalibChartT = elapsed;
        const pushCalib = (chart, val) => {
          if (!chart) return;
          pushPt(chart.data.datasets[0].data, { x: elapsed, y: val });
          pushPt(chart.data.datasets[2].data, { x: elapsed, y: val });
          chart.options.scales.x.min = 0;
          chart.options.scales.x.max = Math.max(CFG.calib, elapsed + 2);
          chart.update('none');
        };
        pushCalib(liveCharts.hr, hrRaw);
        pushCalib(liveCharts.gsr, gsrRaw);
        pushCalib(liveCharts.resp, respRaw);
        if (bpm > 0 && liveCharts.bpm) {
          pushPt(liveCharts.bpm.data.datasets[0].data, { x: elapsed, y: bpm });
          pushPt(liveCharts.bpm.data.datasets[2].data, { x: elapsed, y: bpm });
          liveCharts.bpm.options.scales.x.min = 0;
          liveCharts.bpm.options.scales.x.max = Math.max(CFG.calib, elapsed + 2);
          liveCharts.bpm.update('none');
        }
        if (rpm > 0 && liveCharts.rpm) {
          pushPt(liveCharts.rpm.data.datasets[0].data, { x: elapsed, y: rpm });
          pushPt(liveCharts.rpm.data.datasets[2].data, { x: elapsed, y: rpm });
          liveCharts.rpm.options.scales.x.min = 0;
          liveCharts.rpm.options.scales.x.max = Math.max(CFG.calib, elapsed + 2);
          liveCharts.rpm.update('none');
        }
      }

      // 滾動平均顯示（即時基準值預覽）
      const avg = arr => {
        const valid = arr.filter(v => v != null);
        return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      };
      const cb = S.calibBuf;
      const liveHR   = avg(cb.hr);
      const liveGSR  = avg(cb.gsr);
      const liveResp = avg(cb.resp);
      const liveBPM  = avg(cb.bpm);
      const liveRPM  = avg(cb.rpm);
      const nn = cb.hr.length;

      const ss  = (id, v, d) => { const el = document.getElementById(id); if (el && v != null) el.textContent = v.toFixed(d); };
      const ss2 = (id, v, d) => { const el = document.getElementById(id); if (el && v != null) el.textContent = v.toFixed(d); else if (el) el.textContent = '--'; };
      ss('baseHR',    liveBPM,   1); ss('baseGSR',    liveGSR,  0); ss('baseRR',    liveRPM,  1);
      ss('baseRawHR', liveHR,    0); ss('baseRawRR',  liveResp, 0);
      ss('s_hr_base', liveBPM,   1); ss('s_gsr_base', liveGSR,  1); ss('s_rr_base', liveRPM,  1);
      ss2('mpCalibHR', liveHR, 0); ss2('mpCalibGSR', liveGSR, 0); ss2('mpCalibResp', liveResp, 0);
      ss2('mpCalibBPM', liveBPM, 1); ss2('mpCalibRPM', liveRPM, 1);
      const nEl = document.getElementById('mpCalibN'); if (nEl) nEl.textContent = nn + ' pts';

      const mpBPM = document.getElementById('mpBPM');
      const mpRPM = document.getElementById('mpRPM');
      const mpSc  = document.getElementById('mpScore');
      if (mpBPM) mpBPM.textContent = bpm > 0 ? bpm.toFixed(1) : '--';
      if (mpRPM) mpRPM.textContent = rpm > 0 ? rpm.toFixed(1) : '--';
      if (mpSc)  mpSc.textContent  = '校正中';

      if (typeof mpCalibChartsPush === 'function') mpCalibChartsPush(elapsed, hrRaw, gsrRaw, respRaw);
      updateOverview(elapsed, hrRaw, gsrRaw, respRaw);
      return;
    }

    // ── Running：計算壓力分數並儲存 ─────────────────────────
    // ★ 依照公式文件：Score = S_HR×w_hr + S_GSR×w_gsr + S_RPM×w_resp
    //   v12.5.3：嚴格遵循公式，不做 wUsed 正規化（避免乘以 100 的 bug）
    //   缺少 RPM 基準值時 sResp=0，Score 上限自然降為 60，如實反映數據
    let stress = 0;
    const b = S.base;
    const hasFEBpm = b && b.bpm != null && b.bpm > 0;
    const hasFERpm = b && b.rpm != null && b.rpm > 0;
    const hasFEGsr = b && b.gsr != null && b.gsr > 0;
    const hasFEBase = hasFEBpm || hasFERpm || hasFEGsr;

    if (hasFEBase) {
      const w_hr   = CFG.w_hr   ?? 0.4;
      const w_gsr  = CFG.w_gsr  ?? 0.2;
      const w_resp = CFG.w_resp ?? 0.4;

      let sHR = 0, sResp = 0, sGSR = 0;

      if (hasFEBpm && bpm > 0) {
        const hrLow  = b.bpm * 1.20;
        const hrHigh = b.bpm * 1.50;
        sHR = Math.max(0, Math.min(100, (bpm - hrLow) / (hrHigh - hrLow) * 100));
      }
      if (hasFERpm && rpm > 0) {
        const rpmLow  = b.rpm * 1.25;
        const rpmHigh = b.rpm * 1.60;
        sResp = Math.max(0, Math.min(100, (rpm - rpmLow) / (rpmHigh - rpmLow) * 100));
      }
      if (hasFEGsr) {
        const gsrHigh = b.gsr * 0.80;
        const gsrLow  = b.gsr * 0.50;
        sGSR = Math.max(0, Math.min(100, (gsrHigh - gsrRaw) / (gsrHigh - gsrLow) * 100));
      }

      // 嚴格依照公式文件，直接加權求和（各子分數已是 0–100）
      stress = Math.max(0, Math.min(100, sHR * w_hr + sGSR * w_gsr + sResp * w_resp));
    } else {
      // fallback：使用 ESP32 傳來的 score
      const espScore = (p.length >= 10) ? parseFloat(p[8]) : parseFloat(p[7]);
      stress = isNaN(espScore) ? 0 : espScore;
    }
    const sc = { stress };

    S.hr.push({ t, raw: hrRaw, bpm });
    S.gsr.push({ t, raw: gsrRaw, pct: (S.base.gsr && S.base.gsr > 0) ? ((gsrRaw - S.base.gsr) / S.base.gsr * 100) : null });
    S.resp.push({ t, raw: respRaw, rpm });
    S.score.push({ t, val: sc.stress });

    updateOverview(t, hrRaw, gsrRaw, respRaw);
    const _ci = 1 / (CFG.chart_rate || 10);
    if (t - (S._lastChartT || -999) >= _ci) {
      S._lastChartT = t;
      updateLiveChart(liveCharts.hr, t, hrRaw, hrRaw);
      updateLiveChart(liveCharts.gsr, t, gsrRaw, gsrRaw);
      updateLiveChart(liveCharts.resp, t, respRaw, respRaw);
      if (bpm > 0 && liveCharts.bpm) {
        pushPt(liveCharts.bpm.data.datasets[0].data, { x: t, y: bpm });
        liveCharts.bpm.update('none');
      }
      if (rpm > 0 && liveCharts.rpm) {
        pushPt(liveCharts.rpm.data.datasets[0].data, { x: t, y: rpm });
        liveCharts.rpm.update('none');
      }
    }
    updateStressGauge(sc.stress);
    updateStatsUI(t, hrRaw, gsrRaw, respRaw, bpm, rpm);
    if (typeof updateQualityPanel === 'function') updateQualityPanel();
    updateLogTable(t, gsrRaw, hrRaw, respRaw, bpm, rpm, sc.stress);
    return;
  }
}

// ── 從原始呼吸波形計算基礎 RPM（自相關法）─────────────────────
// 不依賴即時峰值偵測，即使靜息呼吸幅度極小（<2%）仍可正確計算
// 原理：找出訊號與自身延遲版本相關性最高的 lag，即呼吸週期
// respArr: calibBuf.resp 原始 ADC 陣列（20Hz），至少需要 10 秒資料
function _computeRpmFromRespBuf(respArr) {
  const N = respArr.length;
  if (N < 200) return null;   // 至少需要 10 秒

  // 1. 去均值
  const mean = respArr.reduce((a, b) => a + b, 0) / N;
  const sig = respArr.map(v => v - mean);

  // 2. 計算訊號方差（正規化用）
  const variance = sig.reduce((s, v) => s + v * v, 0);
  if (variance < 1e-9) return null;  // 訊號無變化

  // 3. 計算自相關係數 R(lag)，lag 範圍對應呼吸頻率 6–40 RPM
  //    20Hz 取樣：lag 30 = 1.5s = 40 RPM，lag 200 = 10s = 6 RPM
  let bestLag = 0, bestAcf = -Infinity;
  for (let lag = 30; lag <= 200; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) sum += sig[i] * sig[i + lag];
    const acf = sum / variance;
    if (acf > bestAcf) { bestAcf = acf; bestLag = lag; }
  }

  // 4. ACF 品質檢查（太弱表示訊號無規律，不可信）
  if (bestAcf < 0.10) {
    console.log(`[RPM ACF] quality too low (${bestAcf.toFixed(3)}), fallback failed`);
    return null;
  }

  const periodSec = bestLag / 20;   // 取樣率 20Hz
  const rpm = 60 / periodSec;
  console.log(`[RPM ACF] lag=${bestLag} (${periodSec.toFixed(2)}s) ACF=${bestAcf.toFixed(3)} → RPM=${rpm.toFixed(1)}`);

  return (rpm >= 3 && rpm <= 35) ? +rpm.toFixed(1) : null;
}

// ── Baseline UI ─────────────────────────────────────────────
function updateBaselineUI() {
  const b = S.base;
  const ss = (id, val, d) => { const el = document.getElementById(id); if (el) el.textContent = val != null ? val.toFixed(d) : '--'; };
  ss('baseHR',    b.bpm,  1); ss('baseGSR', b.gsr, 0); ss('baseRR',    b.rpm,  1);
  ss('baseRawHR', b.hr,   0); ss('baseRawRR', b.resp, 0);
  ss('s_hr_base', b.bpm,  1); ss('s_gsr_base', b.gsr, 1); ss('s_rr_base', b.rpm,  1);
  S.calibEndSec = CFG.calib;
}

function _mpShowBaselineResult() {
  const b = S.base;
  const buf = S.calibBuf || {};
  const n = (buf.hr || []).length;
  const ss = (id, val, dec) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (val != null && !isNaN(val)) ? Number(val).toFixed(dec) : '--';
  };
  ss('mpBaseBPM', b.bpm, 1); ss('mpBaseRPM', b.rpm, 1);
  ss('mpBaseGSR', b.gsr, 0); ss('mpBaseN', n, 0);

  const mpBPM = document.getElementById('mpBPM');
  const mpRPM = document.getElementById('mpRPM');
  const mpSc = document.getElementById('mpScore');
  if (mpBPM) mpBPM.textContent = b.bpm != null ? b.bpm.toFixed(1) : '--';
  if (mpRPM) mpRPM.textContent = b.rpm != null ? b.rpm.toFixed(1) : '--';
  if (mpSc) mpSc.textContent = '--';

  const noteEl = document.getElementById('mpBaseNote');
  if (noteEl) {
    const bpmNote  = b.bpm  != null ? `BaseBPM ${b.bpm.toFixed(1)}`  : '未偵測到 BPM';
    const rpmNote  = b.rpm  != null ? `BaseRPM ${b.rpm.toFixed(1)}`  : '未偵測到 RPM';
    const thrNote  = (S.threshHR != null) ? ` | HR閾值 ${S.threshHR}  Resp閾值 ${S.threshResp}` : '';
    noteEl.innerHTML = `壓力演算法基準：${bpmNote} · ${rpmNote} · GSR ${b.gsr != null ? b.gsr.toFixed(0) : '--'}${thrNote}`;
  }
}
