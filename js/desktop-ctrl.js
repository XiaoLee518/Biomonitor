// Desktop Control Bar
// Click handlers + inject into mpUpdate for zero-lag sync

// ── Click Handlers ──────────────────────────────────────────
document.getElementById('dkBleBtn')?.addEventListener('click', function() {
  document.getElementById('bleModal')?.classList.add('show');
});

document.getElementById('dkDemoBtn')?.addEventListener('click', function() {
  if (typeof _mp === 'undefined') return;
  if (_mp.mode === 'demo') {
    mpDoStop(); _mp.mode = 'none';
  } else {
    _mp.mode = 'demo'; _mp.state = 'idle';
  }
  mpUpdateConn(); mpUpdate();
});

document.getElementById('dkMainBtn')?.addEventListener('click', function() {
  if (typeof _mp === 'undefined') return;
  if      (_mp.state === 'idle')              mpDoCalib();
  else if (_mp.state === 'calibrating')       mpDoStop();
  else if (_mp.state === 'waiting_for_start') mpDoStart();
  else if (_mp.state === 'running')           mpDoPause();
  else if (_mp.state === 'paused')            mpDoResume();
});

document.getElementById('dkStopBtn')?.addEventListener('click', function() {
  if (typeof mpDoStop === 'function') mpDoStop();
});

document.getElementById('dkCsvBtn')?.addEventListener('click', function() {
  if (typeof exportCsv === 'function') exportCsv();
});

// ── Sync Function ───────────────────────────────────────────
function dkSync() {
  if (typeof _mp === 'undefined') return;
  var s = _mp.state;
  var mode = _mp.mode;
  var connected = mode !== 'none';
  var btn = document.getElementById('dkMainBtn');
  var stop = document.getElementById('dkStopBtn');
  var dot = document.getElementById('dkConnDot');
  var label = document.getElementById('dkConnLabel');

  if (btn) {
    if (s === 'calibrating')       { btn.textContent='中止校正'; btn.style.background='linear-gradient(135deg,#e74c3c,#c0392b)'; btn.style.color='#fff'; btn.disabled=false; }
    else if (s === 'waiting_for_start') { btn.textContent='開始量測'; btn.style.background='linear-gradient(135deg,#9b7fe8,#7c5cbf)'; btn.style.color='#fff'; btn.disabled=false; }
    else if (s === 'running')      { btn.textContent='暫停量測'; btn.style.background='linear-gradient(135deg,#f0b429,#d4940a)'; btn.style.color='#000'; btn.disabled=false; }
    else if (s === 'paused')       { btn.textContent='繼續量測'; btn.style.background='linear-gradient(135deg,#3ecf8e,#2eaf78)'; btn.style.color='#000'; btn.disabled=false; }
    else                           { btn.textContent='開始校正'; btn.style.background='linear-gradient(135deg,#3ecf8e,#2eaf78)'; btn.style.color='#000'; btn.disabled=!connected; }
  }
  if (stop) {
    var canStop = (s==='running'||s==='paused'||s==='waiting_for_start'||s==='calibrating');
    stop.disabled = !canStop;
    stop.style.opacity = canStop ? '1' : '.3';
  }
  if (dot) dot.style.background = mode==='ble'?'#3ecf8e':mode==='demo'?'#9b7fe8':'var(--text3)';
  if (label) label.textContent = mode==='ble'?'BLE':mode==='demo'?'Demo':'未連線';

  var conns = [['dkBleBtn','ble'],['dkDemoBtn','demo']];
  for (var i=0;i<conns.length;i++) {
    var el = document.getElementById(conns[i][0]);
    if (el) { el.style.borderColor = (mode===conns[i][1])?'var(--green)':''; el.style.color = (mode===conns[i][1])?'var(--green)':''; }
  }
}

// ── Override mpUpdate to also sync desktop bar ──────────────
var _dk_origMpUpdate = mpUpdate;
mpUpdate = function() {
  _dk_origMpUpdate();
  dkSync();
};

// ── Override mpUpdateConn to also sync ──────────────────────
var _dk_origMpUpdateConn = mpUpdateConn;
mpUpdateConn = function() {
  _dk_origMpUpdateConn();
  dkSync();
};

// Initial sync
dkSync();
