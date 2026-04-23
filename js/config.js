// Global config
const CFG = {
  thresh_calib: 20,  // ★ Phase 1 動態閾值校正時間（秒）
  calib: 60,         // Phase 2 基準值採集時間（秒）
  data_rate: 25,     // ESP32 封包頻率 Hz
  chart_rate: 10,    // 圖表更新頻率 Hz
  // 壓力分數權重（與韌體預設值一致）
  w_hr:   0.4,
  w_gsr:  0.2,
  w_resp: 0.4,
};
