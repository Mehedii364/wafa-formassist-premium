// WAFA FormAssist Content Script — Safe User-Approved Autofill Runner with Verification
(() => {
  function dispatchFormEvents(el) {
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new Event('blur', {bubbles: true}));
  }

  function applyApprovedFields(approvedFields) {
    let filledCount = 0;
    let failedCount = 0;
    const details = [];

    for (const item of approvedFields) {
      const el = document.querySelector(`[data-wafa-key="${CSS.escape(item.elementKey)}"]`);
      if (!el) {
        failedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, reason: 'Element no longer in DOM'});
        continue;
      }

      const tag = el.tagName.toLowerCase();
      const type = tag === 'input' ? (el.type || 'text').toLowerCase() : tag;

      // Double-guard security boundary inside content script
      if (type === 'password' || type === 'file') {
        failedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, reason: 'Blocked protected control'});
        continue;
      }

      try {
        if (type === 'checkbox') {
          const desired = String(item.transformedValue).toLowerCase() === 'true';
          el.checked = desired;
          dispatchFormEvents(el);
          const verified = el.checked === desired;
          verified ? (filledCount += 1) : (failedCount += 1);
          details.push({elementKey: item.elementKey, ok: verified});
        } else if (type === 'radio') {
          const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
          let matchedRadio = null;
          for (const r of radios) {
            if (r.value.toLowerCase() === String(item.transformedValue).toLowerCase()) {
              matchedRadio = r;
              break;
            }
          }
          if (matchedRadio) {
            matchedRadio.checked = true;
            dispatchFormEvents(matchedRadio);
            filledCount += 1;
            details.push({elementKey: item.elementKey, ok: true});
          } else {
            failedCount += 1;
            details.push({elementKey: item.elementKey, ok: false, reason: 'No matching radio value'});
          }
        } else {
          el.value = String(item.transformedValue);
          dispatchFormEvents(el);
          const verified = String(el.value) === String(item.transformedValue);
          verified ? (filledCount += 1) : (failedCount += 1);
          details.push({
            elementKey: item.elementKey,
            ok: verified,
            reason: verified ? undefined : 'Value rejected or reset by page script',
          });
        }
      } catch {
        failedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, reason: 'DOM write error'});
      }
    }

    return {filledCount, failedCount, details};
  }

  window.__wafaAutofillRunner = {applyApprovedFields};
})();
