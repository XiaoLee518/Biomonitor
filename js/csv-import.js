// CSV Import for Analysis Page
// Supports: Baseline CSV + Measurement CSV

document.getElementById('csvImportBase')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  if (!rows.length) { alert('CSV 為空'); return; }

  // Column names match export: hr_raw_b, gsr_raw_b, resp_raw_b, BPM_b, RPM_b
  const bpmVals = rows.map(r => parseFloat(r.BPM_b)).filter(v => v > 0);
  const rpmVals = rows.map(r => parseFloat(r.RPM_b)).filter(v => v > 0);
  const gsrVals = rows.map(r => parseFloat(r.gsr_raw_b)).filter(v => v > 0);
  const hrVals  = rows.map(r => parseFloat(r.hr_raw_b)).filter(v => v > 0);

  S.base.bpm  = bpmVals.length ? bpmVals.reduce((a,b)=>a+b,0)/bpmVals.length : null;
  S.base.rpm  = rpmVals.length ? rpmVals.reduce((a,b)=>a+b,0)/rpmVals.length : null;
  S.base.gsr  = gsrVals.length ? gsrVals.reduce((a,b)=>a+b,0)/gsrVals.length : null;
  S.base.hr   = hrVals.length  ? hrVals.reduce((a,b)=>a+b,0)/hrVals.length   : null;

  // Store raw calibration data
  S.calibBuf = {
    hr:   rows.map(r => parseFloat(r.hr_raw_b)   || 0),
    gsr:  rows.map(r => parseFloat(r.gsr_raw_b)  || 0),
    resp: rows.map(r => parseFloat(r.resp_raw_b) || 0),
    bpm:  bpmVals,
    rpm:  rpmVals,
  };

  updateBaselineUI();
  _mpShowBaselineResult();
  document.getElementById('anaFileName').textContent = `基準: ${file.name}`;
  alert(`基準值匯入完成\nBaseBPM: ${S.base.bpm?.toFixed(1) ?? '--'}\nBaseRPM: ${S.base.rpm?.toFixed(1) ?? '--'}\nBaseGSR: ${S.base.gsr?.toFixed(0) ?? '--'}`);
  e.target.value = '';
});

document.getElementById('csvImportMeas')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  if (!rows.length) { alert('CSV 為空'); return; }

  // Column names match export: base_gsr, base_bpm, base_rpm, hr_raw, gsr_raw, resp_raw, BPM, RPM
  const r0 = rows[0];
  if (r0.base_gsr && !S.base.gsr) S.base.gsr = parseFloat(r0.base_gsr);
  if (r0.base_bpm && !S.base.bpm) S.base.bpm = parseFloat(r0.base_bpm);
  if (r0.base_rpm && !S.base.rpm) S.base.rpm = parseFloat(r0.base_rpm);

  // Clear and load measurement data
  S.hr = []; S.gsr = []; S.resp = []; S.score = [];

  for (const r of rows) {
    const t = parseFloat(r.time_s);
    if (isNaN(t)) continue;
    const bpm    = parseFloat(r.BPM)     || 0;
    const rpm    = parseFloat(r.RPM)     || 0;
    const gsrRaw = parseFloat(r.gsr_raw) || 0;
    const hrRaw  = parseFloat(r.hr_raw)  || 0;
    const respRaw= parseFloat(r.resp_raw)|| 0;
    const score  = parseFloat(r.Score)   || 0;

    S.hr.push({ t, raw: hrRaw, bpm });
    S.gsr.push({ t, raw: gsrRaw, pct: S.base.gsr > 0 ? ((gsrRaw - S.base.gsr) / S.base.gsr * 100) : null });
    S.resp.push({ t, raw: respRaw, rpm });
    S.score.push({ t, val: score });
  }

  // Show analysis content
  const empty = document.getElementById('anaEmpty');
  const content = document.getElementById('anaContent');
  if (empty) empty.style.display = 'none';
  if (content) content.classList.remove('hidden');

  document.getElementById('anaFileName').textContent += ` | 量測: ${file.name} (${S.hr.length} pts)`;

  // Refresh charts if detail-charts tab exists
  if (typeof dcRefresh === 'function') setTimeout(dcRefresh, 200);

  alert(`量測資料匯入完成：${S.hr.length} 筆\n時間範圍: 0 - ${S.hr[S.hr.length-1]?.t.toFixed(1)}s`);
  e.target.value = '';
});
