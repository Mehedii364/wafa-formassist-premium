// WAFA FormAssist Content Script Entry — Scoped strictly to verified application routes
(() => {
  let dynamicFieldCount = 0;

  // Observe dynamic form controls (e.g., AJAX Upazila dropdowns) safely
  const observer = new MutationObserver(() => {
    const count = document.querySelectorAll('input, select, textarea').length;
    if (count !== dynamicFieldCount) {
      dynamicFieldCount = count;
    }
  });

  if (document.body) {
    observer.observe(document.body, {childList: true, subtree: true});
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    if (message.type === 'WAFA_CONTENT_SCAN_FORM') {
      const fields = window.__wafaFormScanner?.scanDocumentForms(document) || [];
      sendResponse({ok: true, fields, fieldCount: fields.length});
      return false;
    }

    if (message.type === 'WAFA_CONTENT_APPLY_AUTOFILL') {
      const approved = message.payload?.approvedFields || [];
      const report = window.__wafaAutofillRunner?.applyApprovedFields(approved) || {
        filledCount: 0,
        failedCount: approved.length,
        details: [],
      };
      sendResponse({ok: true, ...report});
      return false;
    }

    return false;
  });
})();
