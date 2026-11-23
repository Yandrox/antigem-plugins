'use strict';

// Puente de A11y Audit: ejecuta el recolector serializado en el mundo aislado.
// Algunos WebViews no exponen crypto.randomUUID y el facade de mensajería lo
// necesita para responder, así que se aporta antes de registrar el listener.
try {
  if (!globalThis.crypto) globalThis.crypto = {};
  if (typeof globalThis.crypto.randomUUID !== 'function') {
    globalThis.crypto.randomUUID = function randomUUID() {
      const bytes = new Uint8Array(16);
      if (typeof globalThis.crypto.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index++) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-` +
        `${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-` +
        `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    };
  }
} catch (_) {
  // El entorno puede no permitir redefinir crypto; seguimos de todos modos.
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'a11y.code') return false;
  (async () => {
    const source = `(${message.code})(...${JSON.stringify(message.args || [])})`;
    return await (0, eval)(source);
  })().then(value => sendResponse({ok: true, value}), error => sendResponse({
    ok: false,
    error: error && error.message ? error.message : String(error)
  }));
  return true;
});
