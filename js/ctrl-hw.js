// Hardware control — simplified for v12 (BLE only, no ctrlPanel)
// Most of the old "ESP32 vs Web authority" UI was removed.
// Only the reset icon in the sidebar header remains.

// Stub — kept so packet.js and ble.js can call it after STATUS packets
function cpOnPhaseChange(_newPhase) { /* ctrlPanel removed; nothing to update */ }

// Show/hide btnCtrl-equivalent based on connection state (now just toggles reset icon)
function updateCtrlBtn() {
  const resetIcon = document.getElementById('btnResetIcon');
  if (S.connMode) {
    if (resetIcon) resetIcon.classList.remove('hidden');
  } else {
    if (resetIcon) resetIcon.classList.add('hidden');
  }
}

// ============================================================
// 重啟 ESP32：送 RESET 指令 → ESP32 回 STATUS,RESETTING → ESP.restart()
// 網頁端在 500ms 後主動斷線，避免卡在假連線狀態
// ============================================================
async function resetEsp32() {
  if (!S.connMode) {
    alert('尚未連線到 ESP32');
    return;
  }
  const ok = confirm(
    '確定要重啟 ESP32 嗎？\n\n' +
    '・校正基準值會被清除\n' +
    '・當前量測會中斷\n' +
    '・約 3 秒後需要重新連線'
  );
  if (!ok) return;

  try {
    await deviceWrite('RESET');
    const mainEl = document.getElementById('statusMainText');
    const subEl  = document.getElementById('statusSubText');
    if (mainEl) mainEl.textContent = 'ESP32 重啟中...';
    if (subEl)  subEl.textContent  = '請於 3 秒後重新連線';
    setTimeout(() => {
      try {
        if (S.bleDevice && S.bleDevice.gatt && S.bleDevice.gatt.connected) {
          S.bleDevice.gatt.disconnect();
        }
      } catch (e) { /* ignore */ }
    }, 500);
  } catch (e) {
    alert('傳送 RESET 失敗：' + e.message);
  }
}

// Wire up the header reset icon
document.getElementById('btnResetIcon')?.addEventListener('click', resetEsp32);
