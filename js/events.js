// Event listeners & nav
// Source: biomonitor_v26.html lines 4370-4482

// ============================================================
// COMPARE PAGE
// ============================================================
const compareSets = [];
let cmpCharts = {};
let cmpAuxLines = { score: [], hr: [], gsr: [], resp: [] };

document.getElementById('btnAddCompare').addEventListener('click', () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv';
  inp.addEventListener('change', function () {
    const file = this.files[0]; if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => {
      const pts = r.data.map(row => ({
        t:     parseFloat(row.time_s || row.sec || 0),
        score: parseFloat(row.Score || row.score || 0),
        hr:    parseFloat(row.hr_raw || row.HR || 0),
        gsr:   parseFloat(row.gsr_raw || row.GSR || 0),
        resp:  parseFloat(row.resp_raw || row.Resp || 0),
        bpm:   parseFloat(row.BPM || 0),
        rpm:   parseFloat(row.RPM || 0),
      })).filter(p => !isNaN(p.t));
      compareSets.push({ name: file.name, pts });
      renderCompare();
    }});
  });
  inp.click();
});
document.getElementById('btnClearCompare').addEventListener('click', () => {
  compareSets.splice(0);
  cmpAuxLines = { score: [], hr: [], gsr: [], resp: [] };
  renderCompare();
});
document.getElementById('btnCmpAddLine').addEventListener('click', () => {
  const t = parseFloat(document.getElementById('cmpAuxT').value);
  if (isNaN(t)) return;
  const target = document.getElementById('cmpAuxTarget').value;
  cmpAuxLines[target].push(t);
  renderCompare();
});
document.getElementById('btnCmpClearLines').addEventListener('click', () => {
  cmpAuxLines = { score: [], hr: [], gsr: [], resp: [] };
  renderCompare();
});

function cmpStatsRow(set, idx, colors) {
  const pts = set.pts;
  if (!pts.length) return '';
  const avg = key => pts.reduce((a, p) => a + p[key], 0) / pts.length;
  const max = key => Math.max(...pts.map(p => p[key]));
  const dur = pts[pts.length-1].t - pts[0].t;
  const events60 = pts.filter(p => p.score >= 100).length;
  const c = colors[idx % colors.length];
  return `<tr>
    <td style="color:${c};font-weight:600">${set.name}</td>
    <td>${dur.toFixed(0)}</td>
    <td class="hl">${avg('score').toFixed(1)}</td>
    <td>${max('score').toFixed(1)}</td>
    <td>${events60}</td>
    <td>${avg('hr').toFixed(1)}</td>
    <td>${avg('gsr').toFixed(1)}</td>
    <td>${avg('resp').toFixed(1)}</td>
 </tr>`;
}

function auxLineDatasets(key, colors) {
  return (cmpAuxLines[key] || []).map((t, i) => ({
    label: `Line @${t}s`,
    data: [{ x: t, y: 0 }, { x: t, y: 99999 }],
    borderColor: '#ffffff55',
    borderWidth: 1,
    borderDash: [3, 3],
    pointRadius: 0,
    fill: false,
  }));
}

function renderCompare() {
  const colors = ['#4a9eff', '#f2666a', '#f0b429', '#3ecf8e', '#9b7fe8', '#ff6ec7'];
  const fileList = document.getElementById('compareFileList');
  fileList.innerHTML = compareSets.map((s, i) =>
    `<span style="color:${colors[i%colors.length]};margin-right:12px">■ [${i+1}] ${s.name}</span>`
  ).join('');

  // Stats
  const tbody = document.getElementById('cmpStatsBody');
  tbody.innerHTML = compareSets.map((s, i) => cmpStatsRow(s, i, colors)).join('');

  const legOpts = {
    plugins: { legend: { display: true, labels: { color: '#7a8099', font: { size: 9, family: 'IBM Plex Mono' }, boxWidth: 10, padding: 8,
      filter: item => !item.text.startsWith('Line @')
    }}}
  };

  const mkDs = (s, key, i) => ({
    label: `#${i+1} ${s.name}`,
    data: s.pts.map(p => ({ x: p.t, y: p[key] })),
    borderColor: colors[i % colors.length],
    borderWidth: 1.3, pointRadius: 0, fill: false, tension: 0.2,
  });

  ['score','hr','gsr','resp'].forEach(key => {
    const chartId = { score:'cCompareScore', hr:'cCompareHR', gsr:'cCompareGSR', resp:'cCompareResp' }[key];
    if (cmpCharts[key]) cmpCharts[key].destroy();
    const datasets = [
      ...compareSets.map((s, i) => mkDs(s, key, i)),
      ...auxLineDatasets(key, colors),
    ];
    cmpCharts[key] = mkLineChart(chartId, datasets, legOpts);
  });
}

// ============================================================
// ★ BOOT — initialise all live charts (was missing from refactor)
// ============================================================
initLiveCharts();
