// RPM Detection - Conductive Rubber Band
// v12.5.1 — 雙向偏移偵測：自動適應「呼氣高／吸氣低」或「吸氣高／呼氣低」兩種感測器接法
// 5s 滑動基線 → ±3% 偏移觸發 → 峰/谷回復計算呼吸週期

const _rrDet = {
  baselineBuf: [],     // 最近 5 秒的原始值
  BASELINE_SEC: 5,
  sampleRate: 20,      // Hz
  THRESH_PCT: 0.015,   // 基線 ±1.5% 觸發閾值（靜息呼吸幅度約 1–2%，需低閾值）
  DEAD_ZONE_MS: 1500,  // 兩次呼吸最短間隔（對應最快 40 RPM）
  lastPeakMs: 0,
  inBreath: false,     // 目前是否正在呼吸波形中
  breathDir: 0,        // +1 = 上升型（峰值），−1 = 下降型（谷值）
  extremeVal: 0,       // 當前波形的極值（峰或谷）
  lastBPM: 0,
  ibiHistory: [],      // 最近 5 次呼吸間隔（ms）
};

function rrDetectPush(t, rawResp) {
  const now = performance.now();

  // 1. 維護 5 秒滑動基線緩衝
  _rrDet.baselineBuf.push(rawResp);
  const maxBufSize = _rrDet.BASELINE_SEC * _rrDet.sampleRate;
  if (_rrDet.baselineBuf.length > maxBufSize) _rrDet.baselineBuf.shift();
  if (_rrDet.baselineBuf.length < 20) return 0;

  // 2. 計算基線（滑動平均）
  const baseline = _rrDet.baselineBuf.reduce((a, b) => a + b, 0) / _rrDet.baselineBuf.length;
  const hiThresh = baseline * (1 + _rrDet.THRESH_PCT);  // 上偏閾值（高信號型）
  const loThresh = baseline * (1 - _rrDet.THRESH_PCT);  // 下偏閾值（低信號型）

  // 3. 雙向偏移偵測
  if (!_rrDet.inBreath) {
    // 信號超過任一閾值 → 進入呼吸波形
    if (rawResp > hiThresh) {
      _rrDet.inBreath = true; _rrDet.breathDir = 1; _rrDet.extremeVal = rawResp;
    } else if (rawResp < loThresh) {
      _rrDet.inBreath = true; _rrDet.breathDir = -1; _rrDet.extremeVal = rawResp;
    }
  } else {
    // 追蹤極值（峰或谷）
    if (_rrDet.breathDir === 1  && rawResp > _rrDet.extremeVal) _rrDet.extremeVal = rawResp;
    if (_rrDet.breathDir === -1 && rawResp < _rrDet.extremeVal) _rrDet.extremeVal = rawResp;

    // 判斷回復（信號從極值回退 3%）
    const recovered = _rrDet.breathDir === 1
      ? rawResp < _rrDet.extremeVal * 0.97          // 峰後下降
      : rawResp > _rrDet.extremeVal * (1 / 0.97);   // 谷後上升

    if (recovered) {
      // Dead zone + 合理間隔檢查
      if (_rrDet.lastPeakMs > 0 && (now - _rrDet.lastPeakMs) >= _rrDet.DEAD_ZONE_MS) {
        const interval = now - _rrDet.lastPeakMs;
        if (interval >= 1500 && interval <= 12000) {  // 5–40 RPM
          _rrDet.ibiHistory.push(interval);
          if (_rrDet.ibiHistory.length > 5) _rrDet.ibiHistory.shift();
          const sorted = [..._rrDet.ibiHistory].sort((a, b) => a - b);
          _rrDet.lastBPM = +(60000 / sorted[Math.floor(sorted.length / 2)]).toFixed(1);
        }
      }
      _rrDet.lastPeakMs = now;
      _rrDet.inBreath = false;
      _rrDet.extremeVal = 0;
    }
  }

  // 15 秒無偵測 → 清零
  if (_rrDet.lastPeakMs > 0 && (now - _rrDet.lastPeakMs) > 15000) _rrDet.lastBPM = 0;
  return _rrDet.lastBPM;
}

function rrDetectReset() {
  _rrDet.baselineBuf = []; _rrDet.lastPeakMs = 0;
  _rrDet.inBreath = false; _rrDet.breathDir = 0;
  _rrDet.extremeVal = 0; _rrDet.lastBPM = 0; _rrDet.ibiHistory = [];
}
