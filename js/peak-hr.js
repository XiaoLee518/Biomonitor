// BPM Detection - XD-58C Dynamic Threshold
// Moving average filter → dynamic midpoint threshold → IBI 400-1500ms (40-150 BPM)

const _hrDet = {
  buf: [],            // smoothed values for rolling min/max
  filterBuf: [],      // raw samples for moving average
  BUF_SIZE: 100,      // ~2s at 50Hz for dynamic threshold
  FILTER_SIZE: 5,     // moving average window
  lastPeakMs: 0,
  prevAbove: false,
  lastBPM: 0,
  ibiHistory: [],     // last 5 IBI values
  IBI_MIN: 400,       // ms → 150 BPM max
  IBI_MAX: 1500,      // ms → 40 BPM min
};

function hrDetectPush(t, rawHR) {
  const now = performance.now();

  // 1. Moving average filter
  _hrDet.filterBuf.push(rawHR);
  if (_hrDet.filterBuf.length > _hrDet.FILTER_SIZE) _hrDet.filterBuf.shift();
  const smoothed = _hrDet.filterBuf.reduce((a, b) => a + b, 0) / _hrDet.filterBuf.length;

  // 2. Rolling buffer for dynamic threshold
  _hrDet.buf.push(smoothed);
  if (_hrDet.buf.length > _hrDet.BUF_SIZE) _hrDet.buf.shift();
  if (_hrDet.buf.length < 20) return 0;

  // 3. Dynamic threshold = midpoint of rolling max/min
  const rollingMax = Math.max(..._hrDet.buf);
  const rollingMin = Math.min(..._hrDet.buf);
  const threshold = (rollingMax + rollingMin) / 2;

  // 4. Upward crossing → heartbeat
  const above = smoothed > threshold;
  if (above && !_hrDet.prevAbove) {
    if (_hrDet.lastPeakMs > 0) {
      const ibi = now - _hrDet.lastPeakMs;
      if (ibi >= _hrDet.IBI_MIN && ibi <= _hrDet.IBI_MAX) {
        _hrDet.ibiHistory.push(ibi);
        if (_hrDet.ibiHistory.length > 5) _hrDet.ibiHistory.shift();
        const sorted = [..._hrDet.ibiHistory].sort((a, b) => a - b);
        _hrDet.lastBPM = Math.round(60000 / sorted[Math.floor(sorted.length / 2)]);
      }
    }
    _hrDet.lastPeakMs = now;
  }
  _hrDet.prevAbove = above;

  if (_hrDet.lastPeakMs > 0 && (now - _hrDet.lastPeakMs) > 2000) _hrDet.lastBPM = 0;
  return _hrDet.lastBPM;
}

function hrDetectReset() {
  _hrDet.buf = []; _hrDet.filterBuf = []; _hrDet.lastPeakMs = 0;
  _hrDet.prevAbove = false; _hrDet.lastBPM = 0; _hrDet.ibiHistory = [];
}
