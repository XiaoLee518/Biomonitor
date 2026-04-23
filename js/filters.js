// Butterworth filter, FFT analyzer
// Source: biomonitor_v26.html lines 2022-2172

// ── Butterworth 濾波器（v26新增）─────────────────────────────
class ButterworthFilter {
  constructor(lowCut, highCut, fs, order = 2) {
    this.lowCut = lowCut; this.highCut = highCut; this.fs = fs; this.order = order;
    this.coeffs = this.designFilter();
    this.z = new Array(this.order * 2).fill(0);
  }
  designFilter() {
    const w1 = 2 * Math.PI * this.lowCut / this.fs;
    const w2 = 2 * Math.PI * this.highCut / this.fs;
    const w0 = Math.sqrt(w1 * w2);
    const bw = w2 - w1;
    const Q = w0 / bw;
    const K = Math.tan(w0 / 2);
    const norm = 1 / (1 + K / Q + K * K);
    return {
      b: [K / Q * norm, 0, -K / Q * norm],
      a: [1, 2 * (K * K - 1) * norm, (1 - K / Q + K * K) * norm]
    };
  }
  filterSample(x) {
    const { b, a } = this.coeffs;
    const y = b[0] * x + this.z[0];
    this.z[0] = b[1] * x - a[1] * y + this.z[1];
    this.z[1] = b[2] * x - a[2] * y;
    return y;
  }
  filterBuffer(buffer) {
    return buffer.map(sample => this.filterSample(sample));
  }
  reset() { this.z.fill(0); }
}

// ── FFT 分析器（v26新增）────────────────────────────────────
class FFTAnalyzer {
  constructor(size, fs) {
    this.size = size; this.fs = fs;
    this.twiddle = this.computeTwiddle();
  }
  computeTwiddle() {
    const W = [];
    for (let k = 0; k < this.size / 2; k++) {
      const angle = -2 * Math.PI * k / this.size;
      W.push({ re: Math.cos(angle), im: Math.sin(angle) });
    }
    return W;
  }
  fft(signal) {
    const N = this.size;
    if (signal.length !== N) throw new Error(`FFT size mismatch`);
    const X = signal.map(x => ({ re: x, im: 0 }));
    const logN = Math.log2(N);
    for (let i = 0; i < N; i++) {
      const j = this.reverseBits(i, logN);
      if (j > i) [X[i], X[j]] = [X[j], X[i]];
    }
    for (let s = 1; s <= logN; s++) {
      const m = 1 << s;
      const m2 = m >> 1;
      for (let k = 0; k < N; k += m) {
        for (let j = 0; j < m2; j++) {
          const t = this.complexMul(this.twiddle[j * (N / m)], X[k + j + m2]);
          const u = X[k + j];
          X[k + j] = this.complexAdd(u, t);
          X[k + j + m2] = this.complexSub(u, t);
        }
      }
    }
    return X;
  }
  powerSpectrum(signal) {
    const fftResult = this.fft(signal);
    return fftResult.map(c => c.re * c.re + c.im * c.im);
  }
  findPeakFrequency(signal, minFreq = 0, maxFreq = Infinity) {
    const spectrum = this.powerSpectrum(signal);
    const freqRes = this.fs / this.size;
    const minIdx = Math.max(1, Math.ceil(minFreq / freqRes));
    const maxIdx = Math.min(this.size / 2, Math.floor(maxFreq / freqRes));
    let peakIdx = minIdx, peakPower = spectrum[minIdx];
    for (let i = minIdx + 1; i < maxIdx; i++) {
      if (spectrum[i] > peakPower) { peakPower = spectrum[i]; peakIdx = i; }
    }
    return { frequency: peakIdx * freqRes, power: peakPower, index: peakIdx };
  }
  verifyBPM(signal, detectedBPM, tolerance = 0.1) {
    const expectedFreq = detectedBPM / 60;
    const peak = this.findPeakFrequency(signal, 0.5, 4.0);
    const freqError = Math.abs(peak.frequency - expectedFreq);
    const relativeError = freqError / expectedFreq;
    return {
      valid: relativeError < tolerance,
      detectedFreq: peak.frequency,
      expectedFreq: expectedFreq,
      error: relativeError,
      confidence: 1 - relativeError
    };
  }
  reverseBits(n, bits) {
    let reversed = 0;
    for (let i = 0; i < bits; i++) {
      reversed = (reversed << 1) | (n & 1);
      n >>= 1;
    }
    return reversed;
  }
  complexMul(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
  }
  complexAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
  complexSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
}

// 創建濾波器和FFT實例
const FILTER_STATE = {
  hrFilter: new ButterworthFilter(0.7, 3.5, 20, 2),
  fftAnalyzer: new FFTAnalyzer(256, 20),
  enabled: false  // 預設關閉，可在設定中啟用
};

// 整合濾波和驗證
function applyAdvancedFiltering(rawHR, detectedBPM) {
  if (!FILTER_STATE.enabled) return detectedBPM;
  try {
    // 1. Butterworth濾波
    const filtered = FILTER_STATE.hrFilter.filterBuffer(rawHR.map(p => p.raw || p.bpm || p));
    
    // 2. FFT驗證（需要至少256個樣本）
    if (filtered.length >= 256) {
      const last256 = filtered.slice(-256);
      const verification = FILTER_STATE.fftAnalyzer.verifyBPM(last256, detectedBPM);
      
      if (verification.valid) {
        console.log(`[FFT] BPM ${detectedBPM} 驗證通過 (信心度: ${(verification.confidence * 100).toFixed(1)}%)`);
        return detectedBPM;
      } else {
        const correctedBPM = verification.detectedFreq * 60;
        console.warn(`[FFT] BPM ${detectedBPM} 可能為諧波，校正為 ${correctedBPM.toFixed(1)}`);
        return correctedBPM;
      }
    }
    return detectedBPM;
  } catch (e) {
    console.error('[濾波器錯誤]', e);
    return detectedBPM;
  }
}

console.log('[精準度系統 v26] 已載入（含 Butterworth + FFT）');

// LIVE CHARTS
