// Language strings & navigation
// Source: biomonitor_v26.html lines 1854-1885

// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const pg = btn.dataset.page;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tgt = document.getElementById('page-' + pg);
    if (tgt) tgt.classList.add('active');
    // masterPanel removed in v12 — null-safe
    const mp = document.getElementById('masterPanel');
    if (mp) mp.style.display = '';
    if (pg === 'analysis') refreshAnalysis();
  });
});

document.querySelectorAll('.sub-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.subtab;
    btn.closest('.page').querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sub-page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tgt = document.getElementById('subtab-' + id);
    if (tgt) tgt.classList.add('active');
    const mp = document.getElementById('masterPanel');
    if (id === 'report') {
      buildReport();
      if (mp) mp.style.display = 'none';
    } else {
      if (mp) mp.style.display = '';
    }
  });
});
