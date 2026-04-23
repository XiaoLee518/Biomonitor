// SQI, statistics, GSR decomposition
// Source: biomonitor_v26.html lines 1930-2021

// ============================================================
const PRECISION = {
  enabled: true,
  features: {
    sqi: true,
    calib_valid: true,
    gsr_decomp: true,
    smooth: true,
    hrv: false,
  },
  sqi_hr: 100,
  calibQuality: 100,
  hrv_rmssd: null,
};

const GSR_STATE = {
  tonic: [],
  phasic: [],
  scrEvents: [],
};

const SMOOTH_STATE = {
  bpm: null,
  rpm: null,
  score: null,
};

// 訊號品質指標
function calcHR_SQI(rawBuffer, peaks) {
  if (!PRECISION.features.sqi || !rawBuffer || rawBuffer.length < 30) return 100;
  try {
    const signal = rawBuffer.map(p => p.v || p);
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const variance = signal.reduce((a, v) => a + (v - mean) ** 2, 0) / signal.length;
    const snr = mean > 0 ? Math.min(100, (mean / Math.sqrt(variance)) * 10) : 0;
    if (!peaks || peaks.length < 3) return snr * 0.5;
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) intervals.push(peaks[i] - peaks[i - 1]);
    const avgInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdInt = Math.sqrt(intervals.reduce((a, v) => a + (v - avgInt) ** 2, 0) / intervals.length);
    const cv = avgInt > 0 ? (stdInt / avgInt) : 1;
    const consistency = Math.max(0, 100 - cv * 200);
    return snr * 0.6 + consistency * 0.4;
  } catch (e) {
    return 100;
  }
}

// 中位數
function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 3σ移除
function removeOutliers(data) {
  if (!data || data.length < 3) return data;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const std = Math.sqrt(data.reduce((a, v) => a + (v - mean) ** 2, 0) / data.length);
  return data.filter(v => Math.abs(v - mean) < 3 * std);
}

// EMA平滑
function smoothValue(newVal, key, alpha = 0.3) {
  if (!PRECISION.features.smooth) return newVal;
  if (SMOOTH_STATE[key] === null) SMOOTH_STATE[key] = newVal;
  SMOOTH_STATE[key] += alpha * (newVal - SMOOTH_STATE[key]);
  return SMOOTH_STATE[key];
}

// GSR分解
function decomposeGSR(gsrRaw, index) {
  if (!PRECISION.features.gsr_decomp || !S.gsr) return;
  try {
    const windowSize = Math.floor(CFG.data_rate * 3);
    const recentRaw = S.gsr.slice(-windowSize).map(p => p.raw);
    if (recentRaw.length < windowSize) return;
    const tonic = recentRaw.reduce((a, b) => a + b, 0) / recentRaw.length;
    GSR_STATE.tonic[index] = tonic;
    const phasic = gsrRaw - tonic;
    GSR_STATE.phasic[index] = phasic;
    const threshold = (S.base.gsr || 1800) * 0.015;
    const lastEvent = GSR_STATE.scrEvents[GSR_STATE.scrEvents.length - 1];
    const gapOK = !lastEvent || (index - lastEvent.onset > 10);
    if (phasic > threshold && gapOK) {
      GSR_STATE.scrEvents.push({ onset: index, amplitude: phasic, time: S.gsr[index].t });
    }
  } catch (e) {}
}

