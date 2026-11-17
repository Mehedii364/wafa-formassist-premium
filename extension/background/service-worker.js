// WAFA FormAssist Premium — Manifest V3 Background Service Worker
import {routeMessage} from './message-router.js';
import {DEFAULT_EXT_SETTINGS} from '../shared/storage.js';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({wafa_settings: DEFAULT_EXT_SETTINGS});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  routeMessage(message, sender)
    .then((res) => sendResponse(res))
    .catch((err) => sendResponse({ok: false, error: err?.message || 'INTERNAL_EXTENSION_ERROR'}));
  return true; // Keep message channel open for async response
});
