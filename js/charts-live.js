// Live chart instances & update
// Source: biomonitor_v26.html lines 2173-2234

// ============================================================
const liveCharts = {};

function initLiveCharts() {
  const mk = (id, color) => mkLineChart(id, [
    { label: 'raw',      data: [], borderColor: color + '44', borderWidth: 1, pointRadius: 0, fill: false, tension: 0 },
    { label: 'filtered', data: [], borderColor: color, borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.3 },
    { label: 'calib',    data: [], borderColor: color, borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2,
      borderDash: [], segment: { borderColor: () => color + '55' }, opacity: 0.4 },
  ]);

  liveCharts.hr   = mk('cLiveHR',  '#f2666a');
  liveCharts.gsr  = mk('cLiveGSR', '#f0b429');
  liveCharts.resp = mk('cLiveRR',  '#3ecf8e');

  // ★ BPM chart (heart rate in beats/min)
  liveCharts.bpm = mkLineChart('cLiveBPM', [
    { label: 'BPM',   data: [], borderColor: '#f2666a', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.3 },
    { label: 'filt',  data: [], borderColor: '#f2666a99', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3 },
    { label: 'calib', data: [], borderColor: '#f2666a55', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, borderDash: [4,3] },
  ]);

  // ★ RPM chart (respiration rate in breaths/min)
  liveCharts.rpm = mkLineChart('cLiveRPM', [
    { label: 'RPM',   data: [], borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.3 },
    { label: 'filt',  data: [], borderColor: '#3ecf8e99', borderWidth: 1, pointRadius: 0, fill: false, tension: 0.3 },
    { label: 'calib', data: [], borderColor: '#3ecf8e55', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, borderDash: [4,3] },
  ]);

  liveCharts.overview = mkLineChart('cOverview', [
    { label: 'HR raw',   data: [], borderColor: '#f2666a', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y1' },
    { label: 'HR avg',   data: [], borderColor: '#f2666a', borderWidth: 0.8, borderDash: [4,3], pointRadius: 0, fill: false, tension: 0, yAxisID: 'y1' },
    { label: 'GSR raw',  data: [], borderColor: '#f0b429', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y2' },
    { label: 'GSR avg',  data: [], borderColor: '#f0b429', borderWidth: 0.8, borderDash: [4,3], pointRadius: 0, fill: false, tension: 0, yAxisID: 'y2' },
    { label: 'Resp raw', data: [], borderColor: '#3ecf8e', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y3' },
    { label: 'Resp avg', data: [], borderColor: '#3ecf8e', borderWidth: 0.8, borderDash: [4,3], pointRadius: 0, fill: false, tension: 0, yAxisID: 'y3' },
  ], {
    plugins: {
      legend: {
        display: true,
        labels: { color: '#7a8099', font: { size: 9, family: 'IBM Plex Mono' }, boxWidth: 10, padding: 10,
          filter: item => !item.text.includes('avg')
        }
      },
      calibBg: true,
    },
    scales: {
      x: { type: 'linear', grid: { color: '#1a1e28' }, ticks: { color: '#454d66', font: { size: 9 }, maxTicksLimit: 12, stepSize: 1, callback: v => (Math.abs(v - Math.round(v)) < 0.001) ? Math.round(v) : null } },
      y1: { display: false }, y2: { display: false }, y3: { display: false },
    }
  });
}

const MAX_PTS = 1200;
function pushPt(ds, pt) { ds.push(pt); if (ds.length > MAX_PTS) ds.shift(); }

function updateLiveChart(chart, t, raw, filtered) {
  pushPt(chart.data.datasets[0].data, { x: t, y: raw });
  pushPt(chart.data.datasets[1].data, { x: t, y: filtered });
  chart.update('none');
}

let _overviewAvgCtr = 0;
function updateOverview(t, hr, gsr, resp) {
  if (!liveCharts.overview) return;
  const ds = liveCharts.overview.data.datasets;
  pushPt(ds[0].data, { x: t, y: hr });
  pushPt(ds[2].data, { x: t, y: gsr });
  pushPt(ds[4].data, { x: t, y: resp });
  _overviewAvgCtr++;
  if (_overviewAvgCtr % 8 === 0) {
    const a = arr => arr.slice(-30).reduce((s, p) => s + p.y, 0) / Math.min(arr.length, 30);
    pushPt(ds[1].data, { x: t, y: a(ds[0].data) });
    pushPt(ds[3].data, { x: t, y: a(ds[2].data) });
    pushPt(ds[5].data, { x: t, y: a(ds[4].data) });
  }
  liveCharts.overview.update('none');
  // Update data point counter — works during both calibration and running
  const dc = document.getElementById('dataCount');
  if (dc) dc.textContent = S.phase === 'calibrating'
    ? (S.calibBuf ? S.calibBuf.hr.length : 0)
    : S.hr.length;
}

