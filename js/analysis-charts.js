// Detail charts page (BPM / RPM / GSR change rate)
// 2-second interval, zoom/pan, computation details

const DC = { bpmChart: null, rpmChart: null, gsrChart: null, built: false };

// ── Aggregate data to 2-second bins ──────────────────────────
function dcAggregate(arr, key, interval) {
  if (!arr || !arr.length) return [];
  const pts = [];
  let bin = [], binStart = 0;
  for (const p of arr) {
    if (p.t >= binStart + interval) {
      if (bin.length) {
        const avg = bin.reduce((a, b) => a + b, 0) / bin.length;
        pts.push({ x: binStart + interval / 2, y: +avg.toFixed(2) });
      }
      binStart = Math.floor(p.t / interval) * interval;
      bin = [];
    }
    const v = (typeof key === 'function') ? key(p) : p[key];
    if (v != null && isFinite(v)) bin.push(v);
  }
  if (bin.length) {
    const avg = bin.reduce((a, b) => a + b, 0) / bin.length;
    pts.push({ x: binStart + interval / 2, y: +avg.toFixed(2) });
  }
  return pts;
}

// ── Create a zoomable chart ─────────────────────────────────
function dcMakeChart(canvasId, label, color, yLabel) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 1.5,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: '時間 (s)', color: '#888', font: { size: 10 } },
          ticks: {
            color: '#888', font: { size: 9 },
            stepSize: 2,
            callback: v => v.toFixed(0) + 's'
          },
          grid: { color: 'rgba(255,255,255,.04)' }
        },
        y: {
          title: { display: true, text: yLabel, color: '#888', font: { size: 10 } },
          ticks: { color: '#888', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,.06)' }
        }
      },
      plugins: {
        legend: { display: false },
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: null },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true, backgroundColor: 'rgba(74,158,255,.12)', borderColor: 'var(--accent)' },
            mode: 'x'
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${label}: ${ctx.parsed.y}`,
            title: ctx => `${ctx[0].parsed.x.toFixed(1)}s`
          }
        }
      }
    }
  });
}

// ── Build all 4 charts ──────────────────────────────────────
function dcBuildCharts() {
  if (DC.bpmChart) DC.bpmChart.destroy();
  if (DC.rpmChart) DC.rpmChart.destroy();
  if (DC.gsrChart) DC.gsrChart.destroy();
  if (DC.stressChart) DC.stressChart.destroy();

  DC.bpmChart = dcMakeChart('dcBpmChart', 'BPM（校正後）', '#f2666a', 'BPM');
  DC.rpmChart = dcMakeChart('dcRpmChart', 'RPM', '#62cfb2', 'RPM');
  DC.gsrChart = dcMakeChart('dcGsrChart', 'GSR Δ%', '#f0c75e', '變化率 %');
  DC.stressChart = dcMakeChart('dcStressChart', '壓力指數', '#4a9eff', '壓力 (0-100)');
  DC.built = true;
}

// ── Populate charts with data ───────────────────────────────
function dcRefresh() {
  if (!DC.built) dcBuildCharts();
  if (!S.hr.length) return;

  const interval = 2; // 2-second bins

  const bpmData = dcAggregate(S.hr, 'bpm', interval);
  const rpmData = dcAggregate(S.resp, 'rpm', interval);
  const gsrData = dcAggregate(S.gsr, 'pct', interval);
  const stressData = dcAggregate(S.score, 'val', interval);

  if (DC.bpmChart) { DC.bpmChart.data.datasets[0].data = bpmData; DC.bpmChart.update(); }
  if (DC.rpmChart) { DC.rpmChart.data.datasets[0].data = rpmData; DC.rpmChart.update(); }
  if (DC.gsrChart) { DC.gsrChart.data.datasets[0].data = gsrData; DC.gsrChart.update(); }
  if (DC.stressChart) { DC.stressChart.data.datasets[0].data = stressData; DC.stressChart.update(); }

  // Update detail panels
  dcUpdateDetails();
}

// ── Detail panels: computation breakdown ────────────────────
function dcUpdateDetails() {
  // AW removed
  const scores = recalcStress();
  const n = Math.min(S.hr.length, S.gsr.length, S.resp.length);

  // BPM details
  const bpmEl = document.getElementById('dcBpmDetails');
  if (bpmEl && n > 0) {
    let html = '<div style="margin-bottom:6px;font-weight:700;color:var(--text)">BPM 運算細項（每 2 秒平均）</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.6rem">';
    html += '<tr style="color:var(--accent)"><th style="padding:3px 6px;text-align:left">時間</th><th>原始 HR</th><th>BPM (raw)</th><th>濾波</th><th>AW 係數</th><th>BPM (校正後)</th><th>S_HR</th></tr>';
    // Sample every ~2s worth of data points
    const step = Math.max(1, Math.floor(n / 100));
    for (let i = 0; i < n; i += step) {
      const hr = S.hr[i];
      const sc = scores[i] || {};
      html += `<tr style="border-top:1px solid var(--line)">
        <td style="padding:2px 6px">${hr.t.toFixed(1)}s</td>
        <td>${hr.raw}</td>
        <td>${hr.bpmRaw != null ? hr.bpmRaw.toFixed(1) : '--'}</td>
        <td>${hr.filtered ? '✓' : '—'}</td>
        <td>${awCoeff.toFixed(3)}</td>
        <td style="color:var(--red);font-weight:600">${hr.bpm != null ? hr.bpm.toFixed(1) : '--'}</td>
        <td>${sc.s_hr != null ? sc.s_hr.toFixed(1) : '--'}</td>
      </tr>`;
    }
    html += '</table></div>';
    bpmEl.innerHTML = html;
  }

  // RPM details
  const rpmEl = document.getElementById('dcRpmDetails');
  if (rpmEl && n > 0) {
    let html = '<div style="margin-bottom:6px;font-weight:700;color:var(--text)">RPM 運算細項</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.6rem">';
    html += '<tr style="color:var(--cyan)"><th style="padding:3px 6px;text-align:left">時間</th><th>原始 Resp</th><th>RPM</th><th>基線 RPM</th><th>S_Resp</th></tr>';
    const step = Math.max(1, Math.floor(n / 100));
    const baseRPM = (S.base.rpm && S.base.rpm > 0) ? S.base.rpm : 15;
    for (let i = 0; i < n; i += step) {
      const resp = S.resp[i];
      const sc = scores[i] || {};
      html += `<tr style="border-top:1px solid var(--line)">
        <td style="padding:2px 6px">${resp.t.toFixed(1)}s</td>
        <td>${resp.raw}</td>
        <td style="color:var(--cyan);font-weight:600">${resp.rpm != null ? resp.rpm.toFixed(1) : '--'}</td>
        <td>${baseRPM.toFixed(1)}</td>
        <td>${sc.s_resp != null ? sc.s_resp.toFixed(1) : '--'}</td>
      </tr>`;
    }
    html += '</table></div>';
    rpmEl.innerHTML = html;
  }

  // GSR details
  const gsrEl = document.getElementById('dcGsrDetails');
  if (gsrEl && n > 0) {
    let html = '<div style="margin-bottom:6px;font-weight:700;color:var(--text)">GSR 運算細項（相對基線變化率）</div>';
    html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.6rem">';
    html += '<tr style="color:var(--yellow)"><th style="padding:3px 6px;text-align:left">時間</th><th>GSR Raw</th><th>基線 GSR</th><th>Δ%</th><th>S_GSR</th></tr>';
    const step = Math.max(1, Math.floor(n / 100));
    const baseGSR = S.base.gsr || 0;
    for (let i = 0; i < n; i += step) {
      const gsr = S.gsr[i];
      const sc = scores[i] || {};
      html += `<tr style="border-top:1px solid var(--line)">
        <td style="padding:2px 6px">${gsr.t.toFixed(1)}s</td>
        <td>${gsr.raw}</td>
        <td>${baseGSR.toFixed(0)}</td>
        <td style="color:var(--yellow);font-weight:600">${gsr.pct != null ? gsr.pct.toFixed(2) + '%' : '--'}</td>
        <td>${sc.s_gsr != null ? sc.s_gsr.toFixed(1) : '--'}</td>
      </tr>`;
    }
    html += '</table></div>';
    gsrEl.innerHTML = html;
  }
}

// ── Download chart as PNG ───────────────────────────────────
function dcDownloadChart(chart, name) {
  if (!chart) return;
  const url = chart.toBase64Image('image/png', 1);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BioMonitor_${name}_${new Date().toISOString().slice(0,19).replace(/[:\-T]/g,'')}.png`;
  a.click();
}

// ── Event bindings ──────────────────────────────────────────
document.getElementById('dcResetZoom')?.addEventListener('click', () => {
  if (DC.bpmChart) DC.bpmChart.resetZoom();
  if (DC.rpmChart) DC.rpmChart.resetZoom();
  if (DC.gsrChart) DC.gsrChart.resetZoom();
  if (DC.stressChart) DC.stressChart.resetZoom();
});

document.getElementById('dcDownloadAll')?.addEventListener('click', () => {
  dcDownloadChart(DC.bpmChart, 'BPM');
  setTimeout(() => dcDownloadChart(DC.rpmChart, 'RPM'), 300);
  setTimeout(() => dcDownloadChart(DC.gsrChart, 'GSR'), 600);
  setTimeout(() => dcDownloadChart(DC.stressChart, 'Stress'), 900);
});

// Toggle detail panels
['Bpm', 'Rpm', 'Gsr'].forEach(key => {
  document.getElementById(`dc${key}Toggle`)?.addEventListener('click', function() {
    const panel = document.getElementById(`dc${key}Details`);
    if (!panel) return;
    const showing = panel.style.display !== 'none';
    panel.style.display = showing ? 'none' : 'block';
    this.textContent = showing ? '展開運算細項 ▼' : '收合運算細項 ▲';
  });
});

// Auto-refresh when switching to this tab
document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.subtab === 'detail-charts') {
      setTimeout(() => dcRefresh(), 100);
    }
  });
});
