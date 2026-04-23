// CSV Export - Split into Baseline + Measurement files
// Baseline: calibration period data
// Measurement: running period data with baseline averages

// Rebuild stress scores from running data.
// ESP32 already calculates Score server-side and sends it in each DATA packet;
// we stored those into S.score. This helper returns an array aligned to S.hr,
// with per-component breakdowns (s_hr/s_rpm/s_gsr) recomputed on the frontend
// for CSV/analysis display.
function recalcStress() {
  const out = [];
  const b = S.base || {};
  const W_HR = 0.4, W_RPM = 0.4, W_GSR = 0.2;
  const n = S.hr ? S.hr.length : 0;
  for (let i = 0; i < n; i++) {
    const hr   = S.hr[i]   || {};
    const resp = S.resp[i] || {};
    const gsr  = S.gsr[i]  || {};
    const bpm  = hr.bpm;
    const rpm  = resp.rpm;
    const gsrRaw = gsr.raw;

    // S_HR : 1.20× base = 0 分起點, 1.50× base = 100 分頂點
    let s_hr = 0;
    if (b.bpm > 0 && bpm > 0) {
      const lo = b.bpm * 1.20, hi = b.bpm * 1.50;
      s_hr = Math.max(0, Math.min(100, (bpm - lo) / (hi - lo) * 100));
    }
    // S_RPM : 1.25× base = 0 分起點, 1.60× base = 100 分頂點
    let s_rpm = 0;
    if (b.rpm > 0 && rpm > 0) {
      const lo = b.rpm * 1.25, hi = b.rpm * 1.60;
      s_rpm = Math.max(0, Math.min(100, (rpm - lo) / (hi - lo) * 100));
    }
    // S_GSR : 0.80× base = 0 分起點 (阻值需跌破此值才計分), 0.50× base = 100 分
    let s_gsr = 0;
    if (b.gsr > 0 && gsrRaw != null) {
      const hi = b.gsr * 0.80, lo = b.gsr * 0.50;
      s_gsr = Math.max(0, Math.min(100, (hi - gsrRaw) / (hi - lo) * 100));
    }

    // v12.5.3：依照公式文件重算，不採用即時分數（避免歷史 bug 污染 CSV）
    // Score = S_HR × w_hr + S_GSR × w_gsr + S_RPM × w_resp
    const val = Math.max(0, Math.min(100, s_hr * W_HR + s_rpm * W_RPM + s_gsr * W_GSR));

    out.push({
      t: hr.t,
      val,
      s_hr,
      s_rpm,
      s_resp: s_rpm,  // alias for legacy callers that use s_resp
      s_gsr,
    });
  }
  return out;
}

function exportCsv() {
  if (!S.hr.length) { alert('尚無數據'); return; }
  const ts = new Date().toISOString().slice(0, 19).replace(/[:\-T]/g, '');
  const scores = recalcStress();

  // ── Baseline CSV ──────────────────────────────────────────
  let csvBase = 'time_s,hr_raw_b,gsr_raw_b,resp_raw_b,BPM_b,RPM_b\n';
  if (S.calibBuf) {
    const cb = S.calibBuf;
    const n = cb.hr?.length || 0;
    for (let i = 0; i < n; i++) {
      const t = cb.t?.[i] != null ? cb.t[i].toFixed(3) : ((i + 1) / (CFG.data_rate || 25)).toFixed(3);
      csvBase += [
        t,
        cb.hr?.[i]   ?? '',
        cb.gsr?.[i]  ?? '',
        cb.resp?.[i] ?? '',
        cb.bpm?.[i]  != null ? Number(cb.bpm[i]).toFixed(1) : '',
        cb.rpm?.[i]  != null ? Number(cb.rpm[i]).toFixed(1) : '',
      ].join(',') + '\n';
    }
  }

  // ── Measurement CSV ───────────────────────────────────────
  const baseGSR = S.base.gsr != null ? S.base.gsr.toFixed(1) : '';
  const baseBPM = S.base.bpm != null ? S.base.bpm.toFixed(1) : '';
  const baseRPM = S.base.rpm != null ? S.base.rpm.toFixed(1) : '';

  let csvMeas = 'time_s,base_gsr,base_bpm,base_rpm,hr_raw,gsr_raw,resp_raw,BPM,RPM,Score,Score_HR,Score_RPM,Score_GSR\n';
  const n = Math.min(S.hr.length, S.gsr.length, S.resp.length);
  for (let i = 0; i < n; i++) {
    const hr   = S.hr[i];
    const gsr  = S.gsr[i]  || {};
    const resp = S.resp[i] || {};
    const sc   = scores[i] || {};
    csvMeas += [
      hr.t.toFixed(3),
      baseGSR, baseBPM, baseRPM,
      hr.raw   ?? '',
      gsr.raw  ?? '',
      resp.raw ?? '',
      hr.bpm   != null ? hr.bpm.toFixed(1)   : '',
      resp.rpm != null ? resp.rpm.toFixed(1)  : '',
      sc.val   != null ? sc.val.toFixed(3)    : '',
      sc.s_hr  != null ? sc.s_hr.toFixed(3)   : '',
      sc.s_resp != null ? sc.s_resp.toFixed(3) : '',
      sc.s_gsr != null ? sc.s_gsr.toFixed(3)  : '',
    ].join(',') + '\n';
  }

  // Download both
  _dlFile(csvBase, `BioMonitor_Baseline_${ts}.csv`);
  setTimeout(() => _dlFile(csvMeas, `BioMonitor_Measurement_${ts}.csv`), 300);
}

function _dlFile(content, fname) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
}
