// WAFA FormAssist Content Script Entry — Scoped strictly to verified application routes
// Features debounced MutationObserver for dynamic/AJAX form controls without polling overhead.
(() => {
  let domRevision = 0;
  let lastControlSignature = '';
  let debounceTimer = null;

  function computeControlSignature() {
    const controls = document.querySelectorAll('input, select, textarea');
    let optionTotal = 0;
    for (const el of controls) {
      if (el.tagName === 'SELECT') {
        optionTotal += el.options.length;
      }
    }
    return `${controls.length}:${optionTotal}`;
  }

  function scheduleMutationCheck() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const sig = computeControlSignature();
      if (sig !== lastControlSignature) {
        lastControlSignature = sig;
        domRevision += 1;
      }
    }, 250);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        scheduleMutationCheck();
        break;
      }
    }
  });

  if (document.body) {
    lastControlSignature = computeControlSignature();
    observer.observe(document.body, {childList: true, subtree: true});
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;
    if (sender?.id && sender.id !== chrome.runtime.id) return false;

    if (message.type === 'WAFA_CONTENT_SCAN_FORM') {
      const scan = window.__wafaFormScanner?.scanDocumentForms(document) || {
        fields: [],
        protectedSkippedCount: 0,
      };
      sendResponse({
        ok: true,
        fields: scan.fields,
        protectedSkippedCount: scan.protectedSkippedCount,
        fieldCount: scan.fields.length,
        domRevision,
      });
      return false;
    }

    if (message.type === 'WAFA_CONTENT_APPLY_AUTOFILL') {
      const approved = Array.isArray(message.payload?.approvedFields)
        ? message.payload.approvedFields
        : [];
      const runner = window.__wafaAutofillRunner;
      if (!runner?.applyApprovedFields) {
        sendResponse({ok: false, filledCount: 0, skippedCount: 0, failedCount: approved.length, details: []});
        return false;
      }
      Promise.resolve(runner.applyApprovedFields(approved))
        .then((report) => sendResponse({ok: true, ...report}))
        .catch(() =>
          sendResponse({
            ok: false,
            filledCount: 0,
            skippedCount: 0,
            failedCount: approved.length,
            details: [],
          }),
        );
      return true; // Async response
    }

    return false;
  });
})();
