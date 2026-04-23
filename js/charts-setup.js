// Chart theme & factory
// Source: biomonitor_v26.html lines 1886-1929

// ============================================================
// CHART HELPERS
// ============================================================
// ★ 統一 x 軸 tick 格式化：只顯示整數秒，避免浮點亂碼
const _xTicksCfg = {
  color: '#454d66',
  font: { size: 9, family: 'IBM Plex Mono' },
  maxTicksLimit: 10,
  stepSize: 1,
  callback: v => (Math.abs(v - Math.round(v)) < 0.001) ? Math.round(v) : null,
};

const chartDark = {
  responsive: true, maintainAspectRatio: false, animation: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { type: 'linear', grid: { color: '#1a1e28' }, ticks: _xTicksCfg },
    y: { grid: { color: '#1a1e28' }, ticks: { color: '#454d66', font: { size: 9, family: 'IBM Plex Mono' }, maxTicksLimit: 6 } },
  }
};

function mkLineChart(id, datasets, extraOpts = {}) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: Object.assign({}, chartDark, extraOpts),
  });
}

// Calib region background plugin
const calibBgPlugin = {
  id: 'calibBg',
  beforeDraw(chart) {
    if (!S.calibEndSec) return;
    const xScale = chart.scales.x;
    if (!xScale) return;
    const x0 = xScale.getPixelForValue(-S.calibEndSec);
    const x1 = xScale.getPixelForValue(0);
    if (x1 <= x0) return;
    const { ctx, chartArea: { top, bottom } } = chart;
    ctx.save();
    ctx.fillStyle = 'rgba(242,102,106,0.08)';
    ctx.fillRect(x0, top, x1 - x0, bottom - top);
    ctx.restore();
  }
};
Chart.register(calibBgPlugin);

// ============================================================

// ============================================================
// 精準度系統 v25 - 新增功能
