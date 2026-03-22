// Preload script for Electron.
// This file is loaded before the renderer process.

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SEND_CHANNELS = new Set(['oauth-code']);
const ALLOWED_INVOKE_CHANNELS = new Set(['start-oauth']);
const ALLOWED_ON_CHANNELS = new Set(['oauth-token']);

function safeSend(channel, ...args) {
  if (ALLOWED_SEND_CHANNELS.has(channel)) {
    ipcRenderer.send(channel, ...args);
  }
}

function safeInvoke(channel, ...args) {
  if (ALLOWED_INVOKE_CHANNELS.has(channel)) {
    return ipcRenderer.invoke(channel, ...args);
  }
  return Promise.reject(new Error(`Blocked IPC invoke channel: ${channel}`));
}

function safeOn(channel, listener) {
  if (ALLOWED_ON_CHANNELS.has(channel)) {
    ipcRenderer.on(channel, listener);
  }
}

function safeRemoveListener(channel, listener) {
  if (ALLOWED_ON_CHANNELS.has(channel)) {
    ipcRenderer.removeListener(channel, listener);
  }
}

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: safeSend,
    invoke: safeInvoke,
    on: safeOn,
    removeListener: safeRemoveListener,
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  send: safeSend,
  invoke: safeInvoke,
  on: safeOn,
  removeListener: safeRemoveListener,
});
