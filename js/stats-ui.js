// Stress gauge, stats panel, log table
// Source: biomonitor_v26.html lines 2926-3037

// ============================================================
// UI UPDATES
// ============================================================
function updateStressGauge(score) {
  const v = Math.min(100, Math.round(score));   // clamp display to 100
  const raw = Math.round(score);                // keep real value for label
  document.getElementById('stressScore').textContent = raw;
  document.getElementById('gaugeFill').style.width   = v + '%';
  document.getElementById('gaugeNeedle').style.left  = v + '%';
  let color, level;
  if (raw < 30)       { color = '#3ecf8e'; level = 'Relaxed'; }
  else if (raw < 55)  { color = '#3ecf8e'; level = 'Mild'; }
  else if (raw < 80)  { color = '#f0b429'; level = 'Elevated'; }
  else                { color = '#f2666a'; level = 'High Stress'; }
  document.getElementById('stressScore').style.color = color;
  document.getElementById('stressLevel').textContent = level;
}

function runStat(arr) {
  if (!arr.length) return { avg: null, max: null, min: null };
  const v = arr.map(p => p.raw);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return { avg, max: Math.max(...v), min: Math.min(...v) };
}

function countPeaks(arr) {
  if (arr.length < 3) return 0;
  const v = arr.map(p => p.raw);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  let c = 0;
  for (let i = 1; i < v.length - 1; i++)
    if (v[i] > mean && v[i] > v[i-1] && v[i] > v[i+1]) c++;
  return c;
}

function updateStatsUI(t, hrRaw, gsrRaw, respRaw, bpm, rpm) {
  const hrS  = runStat(S.hr);
  const gsrS = runStat(S.gsr);
  const rrS  = runStat(S.resp);

  // HR
  document.getElementById('curRawHR').textContent = hrRaw;
  document.getElementById('curHR').textContent    = bpm > 0 ? bpm.toFixed(1) : '--';
  document.getElementById('s_hr_avg').textContent = hrS.avg ? hrS.avg.toFixed(1) : '--';
  document.getElementById('s_hr_max').textContent = hrS.max ? hrS.max.toFixed(0) : '--';
  document.getElementById('s_hr_min').textContent = hrS.min ? hrS.min.toFixed(0) : '--';
  document.getElementById('s_hr_cnt').textContent = S.hr.length;
  document.getElementById('s_hr_pk').textContent  = countPeaks(S.hr);

  // GSR
  document.getElementById('curGSR').textContent    = gsrRaw;
  document.getElementById('s_gsr_avg').textContent = gsrS.avg ? gsrS.avg.toFixed(1) : '--';
  document.getElementById('s_gsr_max').textContent = gsrS.max ? gsrS.max.toFixed(0) : '--';
  document.getElementById('s_gsr_min').textContent = gsrS.min ? gsrS.min.toFixed(0) : '--';
  document.getElementById('s_gsr_cnt').textContent = S.gsr.length;
  // Show raw in panel before baseline is ready
  if (!S.base.gsr) {
    const v = document.getElementById('mpGsrVal');
    if (v) { v.textContent = gsrRaw; v.style.color = 'var(--text2)'; }
  }

  if (S.base.gsr) {
    // chg = ADC 相對基準的有方向性變化百分比（正 = 往壓力方向）
    const raw_chg_pct = (gsrRaw - S.base.gsr) / S.base.gsr * 100;
    const chg = (false) ? -raw_chg_pct : raw_chg_pct;
    document.getElementById('gsrChange').textContent = chg.toFixed(1) + '%';
    const el = document.getElementById('gsrAlert');
    let gsrLevel = 'ok';
    if (chg >= 20) {
      S.gsrConsec++;
      if (S.gsrConsec >= 3) {
        S.gsrTriggers++;
        document.getElementById('s_gsr_trig').textContent = S.gsrTriggers;
        el.className = 'gsr-alert show gsr-hi';
        const dirWord = (false) ? '下降' : '上升';
        el.textContent = `GSR 警示：ADC 相對基準${dirWord} ${chg.toFixed(1)}%（閾值 ${20}%）`;
        gsrLevel = 'hi';
      } else {
        el.className = 'gsr-alert show gsr-warn';
        el.textContent = `GSR 偵測：變化 ${chg.toFixed(1)}%，確認中...`;
        gsrLevel = 'warn';
      }
    } else {
      S.gsrConsec = 0;
      el.className = 'gsr-alert show gsr-ok';
      el.textContent = `GSR 正常：相對變化 ${chg.toFixed(1)}%`;
    }
    mpUpdateGSR(chg, gsrLevel);
  }

  // Resp
  document.getElementById('curRawRR').textContent = respRaw;
  document.getElementById('curRR').textContent    = rpm > 0 ? rpm.toFixed(1) : '--';
  document.getElementById('s_rr_avg').textContent = rrS.avg ? rrS.avg.toFixed(1) : '--';
  document.getElementById('s_rr_max').textContent = rrS.max ? rrS.max.toFixed(0) : '--';
  document.getElementById('s_rr_min').textContent = rrS.min ? rrS.min.toFixed(0) : '--';
  document.getElementById('s_rr_cnt').textContent = S.resp.length;
  document.getElementById('s_rr_pk').textContent  = countPeaks(S.resp);

  document.getElementById('dataCount').textContent = S.hr.length;
  if (t > 0) document.getElementById('srDisplay').textContent = (S.hr.length / t).toFixed(1) + ' Hz';
}

function updateLogTable(t, gsr, hr, resp, bpm, rpm, score) {
  if (S.hr.length % 1 !== 0) return; // every row
  const tbody = document.getElementById('liveLogBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${t.toFixed(1)}</td><td>${gsr}</td><td>${hr}</td><td>${resp}</td><td>${bpm > 0 ? bpm.toFixed(1) : '--'}</td><td>${rpm > 0 ? rpm.toFixed(1) : '--'}</td><td>${score.toFixed(1)}</td>`;
  tbody.insertBefore(tr, tbody.firstChild);
  if (tbody.children.length > 120) tbody.removeChild(tbody.lastChild);
  document.getElementById('logCount').textContent = S.hr.length + ' rows';
}

