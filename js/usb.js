// USB module — disabled (BLE only build).
// Keeps deviceWrite() available since other modules call it.

S.usbPort       = null;
S.usbReader     = null;
S.usbWriter     = null;
S.usbReading    = false;

// no-op stubs for any leftover callers
async function usbWrite(cmd) { /* USB disabled */ }
function setUsbUI(on)       { /* USB disabled */ }
async function usbDisconnect() { /* USB disabled */ }

// Unified write — BLE only in this build
async function deviceWrite(cmd) {
  if (S.connMode === 'ble') bleWrite(cmd);
}
