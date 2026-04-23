// Chart init & DOMContentLoaded
// Source: biomonitor_v26.html lines 4187-4369

// ============================================================
let anaCharts = {};

function refreshAnalysis() {
  const has = S.hr.length > 0;
  document.getElementById('anaEmpty').classList.toggle('hidden', has);
  document.getElementById('anaContent').classList.toggle('hidden', !has);
  if (!has) return;

  // Baseline info bar
  const bInfo = document.getElementById('anaBaselineInfo');
  if (S.base.hr != null || S.base.gsr != null || S.base.resp != null) {
    bInfo.innerHTML = [
      S.base.hr   != null ? `<span style="background:rgba(242,102,106,.12);border:1px solid rgba(242,102,106,.3);border-radius:4px;padding:3px 10px;color:var(--hr)">HR: <b>${S.base.hr.toFixed(0)}</b></span>` : '',
      S.base.gsr  != null ? `<span style="background:rgba(240,180,41,.12);border:1px solid rgba(240,180,41,.3);border-radius:4px;padding:3px 10px;color:var(--gsr)">GSR: <b>${S.base.gsr.toFixed(0)}</b> <span style="color:var(--text3);font-size:.65rem">(緊張→ADC↓)</span></span>` : '',
      S.base.resp != null ? `<span style="background:rgba(62,207,142,.12);border:1px solid rgba(62,207,142,.3);border-radius:4px;padding:3px 10px;color:var(--rr)">Resp: <b>${S.base.resp.toFixed(0)}</b></span>` : '',
    ].filter(Boolean).join('');
  } else {
    bInfo.innerHTML = '<span style="color:var(--text3);font-size:.76rem">無基準值（ESP32 校正後才會出現）</span>';
  }

  // Full-session stress chart (ESP32 Score preferred, fallback recalc)
  const espOK = S.score && S.score.length > 0 && S.score.some(p => p.val > 0);
  const stressSrc = espOK ? S.score.map(p => ({ t: p.t, val: p.val })) : recalcStress();
  const srcLabel  = espOK ? 'ESP32 計算值' : '前端重算';

  const sv = stressSrc.map(p => p.val);
  const sAvg = sv.length ? (sv.reduce((a,v)=>a+v,0)/sv.length).toFixed(1) : '--';
  const sMax = sv.length ? Math.max(...sv).toFixed(1) : '--';
  let evCnt = 0, inEv = false;
  sv.forEach(v => { if (v>=60&&!inEv){evCnt++;inEv=true;}else if(v<60)inEv=false; });
  document.getElementById('anaStressStats').innerHTML =
    `<span style="color:var(--accent)">avg ${sAvg}</span> &nbsp; <span style="color:var(--red)">max ${sMax}</span> &nbsp; <span style="color:var(--yellow)">事件 ${evCnt}</span> &nbsp; <span style="color:var(--text3)">[${srcLabel}]</span>`;

  if (anaCharts.stressFull) anaCharts.stressFull.destroy();
  if (stressSrc.length > 0) {
    const tMin = stressSrc[0].t, tMax = stressSrc[stressSrc.length-1].t;
    anaCharts.stressFull = new Chart(
      document.getElementById('cAnaStressFull').getContext('2d'), {
      type: 'line',
      data: { datasets: [
        {
          label: 'Stress',
          data: stressSrc.map(p => ({ x: p.t, y: p.val })),
          borderWidth: 2, pointRadius: 0, fill: false, tension: 0.2,
          segment: {
            borderColor: ctx => {
              const v = ctx.p0.parsed.y;
              return v>=80?'#c0392b':v>=60?'#f2666a':v>=30?'#f0b429':'#3ecf8e';
            }
          }
        },
        { label:'60', data:[{x:tMin,y:60},{x:tMax,y:60}], borderColor:'rgba(242,102,106,.5)', borderWidth:1, borderDash:[5,4], pointRadius:0, fill:false },
        { label:'30', data:[{x:tMin,y:30},{x:tMax,y:30}], borderColor:'rgba(240,180,41,.4)',  borderWidth:1, borderDash:[3,4], pointRadius:0, fill:false },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            if (ctx.datasetIndex!==0) return null;
            const v = ctx.parsed.y;
            return `Score: ${v.toFixed(1)} — ${v>=80?'高度緊張':v>=60?'中度緊張':v>=30?'輕度緊張':'放鬆'}`;
          }}}
        },
        scales: {
          x: { type:'linear', grid:{color:'var(--bg3)'}, ticks:{color:'var(--text3)',font:{size:9,family:'IBM Plex Mono'},maxTicksLimit:10} },
          y: { min:0, max:100, grid:{color:'var(--bg3)'}, ticks:{color:'var(--text3)',font:{size:9,family:'IBM Plex Mono'},maxTicksLimit:5} },
        }
      }
    });
  }

  const mkAna = (id, label, color, arr, key) => {
    if (anaCharts[id]) anaCharts[id].destroy();
    anaCharts[id] = mkLineChart(id, [
      { label, data: arr.map(p => ({ x: p.t, y: key ? p[key] : p.raw })).filter(p => p.y > 0),
        borderColor: color, borderWidth: 1.3, pointRadius: 0, fill: false, tension: 0.2 },
    ]);
  };
  mkAna('cAnaHR',  'HR',   '#f2666a', S.hr,   'raw');
  mkAna('cAnaBPM', 'BPM',  '#f2666a', S.hr,   'bpm');
  mkAna('cAnaGSR', 'GSR',  '#f0b429', S.gsr,  'raw');
  mkAna('cAnaRR',  'Resp', '#3ecf8e', S.resp, 'raw');
  mkAna('cAnaRPM', 'RPM',  '#3ecf8e', S.resp, 'rpm');

  buildAnomalyList();
  refreshAdvanced();
}

function buildAnomalyList() {
  const list = document.getElementById('anomalyList');
  list.innerHTML = '';
  const items = [];
  if (S.base.hr) S.hr.forEach(p => { if (p.raw > S.base.hr * 1.2) items.push({ t: p.t, desc: 'HR 超過基準 20%', val: p.raw }); });
  if (S.base.gsr) S.gsr.forEach(p => {
    const chg = (S.base.gsr - p.raw) / S.base.gsr * 100;
    if (chg >= 20) items.push({ t: p.t, desc: `GSR 超閾 ${chg.toFixed(1)}%`, val: p.raw, color: '#f0b429' });
  });
  if (!items.length) { list.innerHTML = '<div style="color:var(--text3);font-size:.78rem;padding:6px">未偵測到明顯異常。</div>'; return; }
  items.filter((_, i) => i % 30 === 0).slice(0, 25).forEach(a => {
    const d = document.createElement('div');
    d.className = 'anomaly-item';
    if (a.color) d.style.borderLeftColor = a.color;
    d.innerHTML = `<span class="an-time">${a.t.toFixed(1)}s</span><span>${a.desc}</span><span class="an-val">${a.val}</span>`;
    list.appendChild(d);
  });
}

function refreshAdvanced() {
  if (anaCharts.adv) { try { anaCharts.adv.destroy(); } catch(_){} }

  const stressData = (() => {
    const espOK = S.score && S.score.length > 0 && S.score.some(p => p.val > 0);
    return espOK ? S.score : recalcStress();
  })();

  anaCharts.adv = mkLineChart('cAdvanced', [
    { label: 'HR',     data: S.hr.map(p   => ({ x: p.t, y: p.raw })), borderColor: '#f2666a', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y1' },
    { label: 'GSR',    data: S.gsr.map(p  => ({ x: p.t, y: p.raw })), borderColor: '#f0b429', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y2' },
    { label: 'Resp',   data: S.resp.map(p => ({ x: p.t, y: p.raw })), borderColor: '#3ecf8e', borderWidth: 1.2, pointRadius: 0, fill: false, tension: 0.2, yAxisID: 'y3' },
    { label: 'Score',  data: stressData.map(p => ({ x: p.t, y: p.val })), borderColor: '#9b7fe8', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, yAxisID: 'y4' },
  ], {
    plugins: {
      legend: { display: true, labels: { color: '#7a8099', font: { size: 9, family: 'IBM Plex Mono' }, boxWidth: 10, padding: 10 } },
      zoom: {
        pan:  { enabled: true,  mode: 'x', threshold: 5 },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
      },
    },
    scales: {
      x: { type: 'linear', grid: { color: '#1a1e28' }, ticks: { color: '#454d66', font: { size: 9 } } },
      y1: { display: false }, y2: { display: false }, y3: { display: false },
      y4: { display: true, position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: '#9b7fe8', font: { size: 8 }, maxTicksLimit: 5 } },
    }
  });

  // hint
  const hint = document.getElementById('advZoomHint');
  if (hint) hint.textContent = '滾輪縮放 · 拖拉平移時間軸';

  // stats table
  const tbody = document.getElementById('advStatsBody');
  tbody.innerHTML = '';
  const row = (label, arr, base, color) => {
    const v = arr.map(p => p.raw);
    if (!v.length) return;
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    const max = Math.max(...v), min = Math.min(...v);
    const std = Math.sqrt(v.map(x => (x - avg) ** 2).reduce((a, b) => a + b, 0) / v.length);
    const pk = countPeaks(arr);
    const dur = arr[arr.length-1].t - arr[0].t;
    const rate = dur > 2 ? Math.round(pk / dur * 60) : '--';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="color:${color}">${label}</td><td>${base != null ? base.toFixed(1) : '--'}</td><td>${avg.toFixed(1)}</td><td>${max}</td><td>${min}</td><td>${std.toFixed(1)}</td><td>${pk}</td><td>${rate}</td>`;
    tbody.appendChild(tr);
  };
  row('HR',   S.hr,   S.base.hr,   '#f2666a');
  row('GSR',  S.gsr,  S.base.gsr,  '#f0b429');
  row('Resp', S.resp, S.base.resp, '#3ecf8e');
}

// Advanced controls
document.getElementById('btnRecalc').addEventListener('click', refreshAdvanced);
document.getElementById('btnAddLine').addEventListener('click', () => {
  const t = parseFloat(prompt('輔助線時間 (秒):'));
  if (!anaCharts.adv || isNaN(t)) return;
  anaCharts.adv.data.datasets.push({ label: `@${t}s`, data: [{ x: t, y: 0 }, { x: t, y: 9999 }], borderColor: '#9b7fe8', borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false, yAxisID: 'y1' });
  anaCharts.adv.update();
});
let zoomLv = 1;
document.getElementById('btnZoomIn').addEventListener('click',    () => { if(anaCharts.adv) anaCharts.adv.zoom(1.5); });
document.getElementById('btnZoomOut').addEventListener('click',   () => { if(anaCharts.adv) anaCharts.adv.zoom(1/1.5); });
document.getElementById('btnZoomReset').addEventListener('click', () => { if(anaCharts.adv) anaCharts.adv.resetZoom(); });
function applyZoom(lv) {
  zoomLv = lv;
  if (!anaCharts.adv) return;
  const maxT = S.hr.length ? S.hr[S.hr.length-1].t : 60;
  anaCharts.adv.options.scales.x.max = lv === 1 ? undefined : maxT / lv;
  anaCharts.adv.update();
}
['adv_whr', 'adv_wgsr', 'adv_wrr'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    document.getElementById(id + '_v').textContent = parseFloat(this.value).toFixed(2);
  });
});

