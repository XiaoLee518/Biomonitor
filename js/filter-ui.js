// Filter UI - Butterworth/FFT toggle only
// Settings sync to CFG on calib slider change

// Calib slider sync
const _slCalib = document.getElementById('sl_calib');
const _cfgCalib = document.getElementById('cfg_calib');
if (_slCalib && _cfgCalib) {
  _slCalib.addEventListener('input', () => { _cfgCalib.value = _slCalib.value; CFG.calib = parseInt(_slCalib.value); });
  _cfgCalib.addEventListener('change', () => { _slCalib.value = _cfgCalib.value; CFG.calib = parseInt(_cfgCalib.value); });
}

// Butterworth filter toggle
const _chkFilter = document.getElementById('chk_advanced_filter');
if (_chkFilter) {
  _chkFilter.addEventListener('change', function() {
    const on = this.checked;
    if (typeof FILTER_STATE !== 'undefined') {
      FILTER_STATE.enabled = on;
      if (!on) FILTER_STATE.hrFilter.reset();
    }
    const label = document.getElementById('filter_status');
    if (label) { label.textContent = on ? '✓ 已啟用' : '關閉'; label.style.color = on ? 'var(--green)' : 'var(--text3)'; }
  });
}

// Send calib to ESP32 on connect
function syncSettingsToESP32() {
  if (typeof deviceWrite === 'function') {
    deviceWrite(`SET_CALIB=${CFG.calib}`);
  }
}
