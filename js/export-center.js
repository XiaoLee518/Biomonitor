// Export center - ZIP with PDF report, all charts, CSV

function ecSetStatus(msg) {
  const el = document.getElementById('ecStatus');
  if (!el) return;
  el.style.display = msg ? 'block' : 'none';
  el.textContent = msg;
  if (msg) setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function ecTimestamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}_${p(d.getMonth()+1)}_${p(d.getDate())}_${p(d.getHours())}_${p(d.getMinutes())}`;
}

function ecChartBlob(chart) {
  return new Promise(r => {
    if (!chart) { r(null); return; }
    fetch(chart.toBase64Image('image/png', 1)).then(x => x.blob()).then(r).catch(() => r(null));
  });
}


// ── PDF Report — opens the styled Analysis Report then triggers browser Print ──
// The browser's "Save as PDF" produces the same A4 output as the report tab's
// 列印/儲存 PDF button.  We do NOT use jsPDF here so the full chart layout,
// baseline cards, stress timeline, and formula labels are all preserved.
function ecGeneratePDF() {
  // Navigate to the report tab and rebuild it, then print
  const reportTab = document.querySelector('[data-page="report"], [href="#report"], .nav-item[data-tab="report"]')
    || document.getElementById('navReport');
  if (reportTab) reportTab.click();
  // Give buildReport() time to render charts before print dialog
  setTimeout(() => {
    if (typeof buildReport === 'function') buildReport();
    setTimeout(() => window.print(), 400);
  }, 200);
}

// ── ZIP Download ────────────────────────────────────────────
document.getElementById('ecDownloadAll')?.addEventListener('click', async () => {
  if (!S.hr.length) { alert('No data'); return; }
  if (typeof JSZip === 'undefined') { alert('JSZip not loaded'); return; }
  ecSetStatus('Packing...');
  const ts = ecTimestamp();
  const name = `${ts}_BioMonitor_Data`;
  const zip = new JSZip();

  // CSV
  if (document.getElementById('ecCsv')?.checked) {
    zip.file(`${name}_Baseline.csv`, ecBaselineCsv());
    zip.file(`${name}_Measurement.csv`, ecMeasurementCsv());
  }

  // Detail charts (from analysis page)
  const detailCharts = [
    ['ecBpmPng', DC?.bpmChart, 'BPM_Detail'],
    ['ecRpmPng', DC?.rpmChart, 'RPM_Detail'],
    ['ecGsrPng', DC?.gsrChart, 'GSR_Detail'],
    ['ecStressPng', DC?.stressChart, 'Stress_Detail'],
  ];
  for (const [id, chart, label] of detailCharts) {
    if (document.getElementById(id)?.checked && chart) {
      const b = await ecChartBlob(chart);
      if (b) zip.file(`${name}_${label}.png`, b);
    }
  }

  // Live charts (from monitoring page)
  if (document.getElementById('ecLiveCharts')?.checked && typeof liveCharts !== 'undefined') {
    const liveMap = [
      [liveCharts.hr, 'Live_HR'],
      [liveCharts.gsr, 'Live_GSR'],
      [liveCharts.resp, 'Live_Resp'],
      [liveCharts.overview, 'Live_Overview'],
    ];
    for (const [chart, label] of liveMap) {
      if (chart) {
        const b = await ecChartBlob(chart);
        if (b) zip.file(`${name}_${label}.png`, b);
      }
    }
  }

  // PDF Report — open styled report + print dialog (cannot add to ZIP directly)
  if (document.getElementById('ecReport')?.checked) {
    ecSetStatus('開啟報告頁並列印/另存為 PDF…');
    ecGeneratePDF();
    // Note: browser print dialog opens separately; ZIP download continues below
  }

  try {
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.zip`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
    ecSetStatus(`✓ ${name}.zip`);
  } catch (e) { ecSetStatus('Error: ' + e.message); }
});

// TXT fallback
function ecReportText() {
  const scores = recalcStress();
  const dur = S.hr.length ? S.hr[S.hr.length - 1].t : 0;
  const n = Math.min(S.hr.length, S.gsr.length, S.resp.length);
  const avgBpm = S.hr.reduce((a, p) => a + (p.bpm || 0), 0) / (S.hr.length || 1);
  const avgRpm = S.resp.reduce((a, p) => a + (p.rpm || 0), 0) / (S.resp.length || 1);
  const avgSc = scores.length ? scores.reduce((a, p) => a + p.val, 0) / scores.length : 0;
  const maxSc = scores.length ? Math.max(...scores.map(p => p.val)) : 0;
  return `=== BioMonitor Report ===\nDate: ${new Date().toLocaleString('zh-TW')}\nDuration: ${dur.toFixed(1)}s | Points: ${n}\nBaseBPM: ${S.base.bpm ?? '--'} | BaseRPM: ${S.base.rpm ?? '--'} | BaseGSR: ${S.base.gsr ?? '--'}\nAvg BPM: ${avgBpm.toFixed(1)} | Avg RPM: ${avgRpm.toFixed(1)}\nAvg Stress: ${avgSc.toFixed(2)} | Peak: ${maxSc.toFixed(2)}\n\nFormula (delta-normalized):\n  S_HR  = max(0, (BPM  - Base_BPM)  / (Base_BPM  x 0.20))  [1.0 = BPM +20% above baseline]\n  S_Resp= max(0, (RPM  - Base_RPM)  / (Base_RPM  x 0.25))  [1.0 = RPM +25% above baseline]\n  S_GSR = max(0, (Base_GSR - GSR)   / (Base_GSR  x 0.20))  [1.0 = GSR -20% below baseline]\n  Score = (S_HR x 0.40 + S_Resp x 0.40 + S_GSR x 0.20) x 100\n  Rest = 0 | Stress threshold = 100 | High stress > 100\n`;
}

// CSV helper functions (used by both export-center and settings-adv)
function ecBaselineCsv() {
  let csv = 'time_s,hr_raw_b,gsr_raw_b,resp_raw_b,BPM_b,RPM_b\n';
  if (S.calibBuf) {
    const cb = S.calibBuf;
    const n = cb.hr?.length || 0;
    for (let i = 0; i < n; i++) {
      const t = cb.t?.[i] != null ? cb.t[i].toFixed(3) : ((i + 1) / (CFG.data_rate || 25)).toFixed(3);
      csv += [
        t,
        cb.hr?.[i]  ?? '',
        cb.gsr?.[i] ?? '',
        cb.resp?.[i] ?? '',
        cb.bpm?.[i]  != null ? Number(cb.bpm[i]).toFixed(1) : '',
        cb.rpm?.[i]  != null ? Number(cb.rpm[i]).toFixed(1) : '',
      ].join(',') + '\n';
    }
  }
  return csv;
}

function ecMeasurementCsv() {
  const scores = recalcStress();
  const bg = S.base.gsr != null ? S.base.gsr.toFixed(1) : '';
  const bb = S.base.bpm != null ? S.base.bpm.toFixed(1) : '';
  const br = S.base.rpm != null ? S.base.rpm.toFixed(1) : '';
  let csv = 'time_s,base_gsr,base_bpm,base_rpm,hr_raw,gsr_raw,resp_raw,BPM,RPM,Score,Score_HR,Score_RPM,Score_GSR\n';
  const n = Math.min(S.hr.length, S.gsr.length, S.resp.length);
  for (let i = 0; i < n; i++) {
    const hr   = S.hr[i],  gsr = S.gsr[i] || {}, resp = S.resp[i] || {}, sc = scores[i] || {};
    csv += [
      hr.t.toFixed(3),
      bg, bb, br,
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
  return csv;
}

document.getElementById('ecDownloadCsv')?.addEventListener('click', () => {
  if (!S.hr.length) { alert('No data'); return; }
  exportCsv();
  ecSetStatus('CSV done');
});

document.getElementById('ecDownloadCharts')?.addEventListener('click', () => {
  if (!DC?.bpmChart) { alert('Go to Detail Charts first'); return; }
  dcDownloadChart(DC.bpmChart, 'BPM');
  setTimeout(() => dcDownloadChart(DC.rpmChart, 'RPM'), 300);
  setTimeout(() => dcDownloadChart(DC.gsrChart, 'GSR'), 600);
  setTimeout(() => dcDownloadChart(DC.stressChart, 'Stress'), 900);
  ecSetStatus('Charts done');
});
