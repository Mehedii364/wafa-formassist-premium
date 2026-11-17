// WAFA FormAssist Premium — Manifest V3 Background Service Worker
// Enforces periodic inactivity auto-lock via chrome.alarms and hardened message routing.

import {routeMessage} from './message-router.js';
import {
  DEFAULT_EXT_SETTINGS,
  checkAndEnforceAutoLock,
  lockExtensionVault,
} from '../shared/storage.js';

const AUTOLOCK_ALARM_NAME = 'wafa-vault-autolock';

function ensureAutoLockAlarm() {
  if (chrome.alarms?.create) {
    chrome.alarms.create(AUTOLOCK_ALARM_NAME, {periodInMinutes: 1});
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({wafa_settings: DEFAULT_EXT_SETTINGS});
  }
  ensureAutoLockAlarm();
});

chrome.runtime.onStartup?.addListener(() => {
  lockExtensionVault();
  ensureAutoLockAlarm();
});

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm?.name === AUTOLOCK_ALARM_NAME) {
    void checkAndEnforceAutoLock();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((res) => sendResponse(res))
    .catch(() => sendResponse({ok: false, error: 'INTERNAL_EXTENSION_ERROR'}));
  return true; // Keep message channel open for async response
});
