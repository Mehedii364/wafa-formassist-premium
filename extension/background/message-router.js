// WAFA FormAssist MV3 — Validated Message Router (Never logs sensitive profile values)

import {verifySupportedUrl} from '../adapters/dgbpo-2026/adapter.js';
import {
  appendExtensionSession,
  getExtensionSettings,
  listExtensionSessions,
  loadVaultSnapshot,
  saveExtensionSettings,
} from '../shared/storage.js';

const ALLOWED_ACTIONS = new Set([
  'WAFA_GET_STATE',
  'WAFA_VERIFY_ACTIVE_TAB',
  'WAFA_SCAN_ACTIVE_TAB',
  'WAFA_EXECUTE_AUTOFILL',
  'WAFA_SAVE_SETTINGS',
]);

export async function routeMessage(message, sender) {
  if (!message || typeof message.type !== 'string' || !ALLOWED_ACTIONS.has(message.type)) {
    return {ok: false, error: 'UNAUTHORIZED_MESSAGE_TYPE'};
  }

  // Only allow messages originating from this extension's own pages or verified supported tabs
  if (sender?.id && sender.id !== chrome.runtime.id) {
    return {ok: false, error: 'UNAUTHORIZED_SENDER'};
  }

  switch (message.type) {
    case 'WAFA_GET_STATE': {
      const [settings, vault, sessions] = await Promise.all([
        getExtensionSettings(),
        loadVaultSnapshot(),
        listExtensionSessions(),
      ]);
      return {ok: true, settings, vault, sessions};
    }

    case 'WAFA_SAVE_SETTINGS': {
      const updated = await saveExtensionSettings(message.payload || {});
      return {ok: true, settings: updated};
    }

    case 'WAFA_VERIFY_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab?.url || '', settings.permittedDomains);
      return {ok: true, tabId: tab?.id || null, verification};
    }

    case 'WAFA_SCAN_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab?.id) return {ok: false, error: 'NO_ACTIVE_TAB'};
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab.url || '', settings.permittedDomains);
      if (!verification.supported) {
        return {ok: false, error: 'UNSUPPORTED_WEBSITE', verification};
      }
      const response = await chrome.tabs.sendMessage(tab.id, {type: 'WAFA_CONTENT_SCAN_FORM'});
      return {ok: true, verification, fields: response?.fields || []};
    }

    case 'WAFA_EXECUTE_AUTOFILL': {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab?.id) return {ok: false, error: 'NO_ACTIVE_TAB'};
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab.url || '', settings.permittedDomains);
      if (!verification.supported) {
        return {ok: false, error: 'PERMISSION_DENIED'};
      }
      const approvedFields = Array.isArray(message.payload?.approvedFields)
        ? message.payload.approvedFields
        : [];
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'WAFA_CONTENT_APPLY_AUTOFILL',
        payload: {approvedFields},
      });

      // Record strictly non-PII session summary
      const sessionRecord = {
        id: `ext-sess-${Date.now()}`,
        schemaVersion: '1.0.0',
        websiteId: verification.adapter?.id || 'dgbpo-2026',
        websiteDomain: verification.domain,
        applicationRoute: verification.route,
        profileId: message.payload?.profileId || 'unknown',
        profileName: message.payload?.profileName || 'Selected Profile',
        timestamp: new Date().toISOString(),
        scannedCount: Number(message.payload?.scannedCount || 0),
        filledCount: Number(result?.filledCount || 0),
        skippedCount: Number(message.payload?.skippedCount || 0),
        unresolvedCount: Number(message.payload?.unresolvedCount || 0),
        failedCount: Number(result?.failedCount || 0),
        status: (result?.failedCount || 0) > 0 ? 'PARTIALLY_COMPLETED' : 'AUTOFILLED',
        verifiedAfterFill: (result?.failedCount || 0) === 0,
      };
      await appendExtensionSession(sessionRecord);
      return {ok: true, result, session: sessionRecord};
    }

    default:
      return {ok: false, error: 'UNKNOWN_ACTION'};
  }
}
