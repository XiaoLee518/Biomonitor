// Quality panel (SQI)
// Source: biomonitor_v26.html lines 4694-4733

function updateQualityPanel() {
  const panel = document.getElementById('mpQualityPanel');
  if (!panel) return;
  
  // 只在監測中顯示
  if (S.phase === 'running' && S.hr && S.hr.length > 10) {
    panel.style.display = 'block';
    
    // 更新SQI
    const sqi = PRECISION.sqi_hr || 0;
    const sqiBar = document.getElementById('mpSqiBar');
    const sqiVal = document.getElementById('mpSqiVal');
    if (sqiBar) sqiBar.style.width = sqi + '%';
    if (sqiVal) {
      sqiVal.textContent = sqi.toFixed(0);
      sqiVal.style.color = sqi >= 70 ? 'var(--green)' : sqi >= 40 ? 'var(--yellow)' : 'var(--red)';
    }
    
    // 更新校正品質
    const calibQ = PRECISION.calibQuality || 0;
    const calibBar = document.getElementById('mpCalibQualityBar');
    const calibVal = document.getElementById('mpCalibQualityVal');
    if (calibBar) calibBar.style.width = calibQ + '%';
    if (calibVal) {
      calibVal.textContent = calibQ.toFixed(0);
      calibVal.style.color = calibQ >= 70 ? 'var(--green)' : calibQ >= 40 ? 'var(--yellow)' : 'var(--red)';
    }
    
    // 更新進階濾波狀態
    const filterStatus = document.getElementById('mpFilterStatus');
    if (filterStatus) {
      filterStatus.textContent = FILTER_STATE.enabled ? '✓ 已啟用' : '關閉';
      filterStatus.style.color = FILTER_STATE.enabled ? 'var(--green)' : 'var(--text3)';
    }
  } else {
    panel.style.display = 'none';
  }
}

// ── Apple Watch 校正（v26）─────────────────────────────────
