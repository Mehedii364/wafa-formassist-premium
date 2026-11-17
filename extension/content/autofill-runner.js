// WAFA FormAssist Content Script — Safe User-Approved Autofill Runner
// Features: Independent sensitive-field block, React-controlled native setters,
// user-entered value preservation unless explicitly approved, and AJAX cascading dropdown waiting.
(() => {
  const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  const inputCheckedSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
  const textareaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  const selectValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

  function setNativeValue(el, value) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && inputValueSetter) {
      inputValueSetter.call(el, value);
    } else if (tag === 'textarea' && textareaValueSetter) {
      textareaValueSetter.call(el, value);
    } else if (tag === 'select' && selectValueSetter) {
      selectValueSetter.call(el, value);
    } else {
      el.value = value;
    }
  }

  function setNativeChecked(el, checked) {
    if (inputCheckedSetter) {
      inputCheckedSetter.call(el, Boolean(checked));
    } else {
      el.checked = Boolean(checked);
    }
  }

  function dispatchFormEvents(el) {
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new Event('blur', {bubbles: true}));
  }

  function normalizeOption(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function findSelectOptionValue(selectEl, desired) {
    const target = String(desired || '').trim();
    const targetNorm = normalizeOption(target);
    const options = Array.from(selectEl.options || []);
    const exactVal = options.find((o) => o.value.trim() === target);
    if (exactVal) return exactVal.value;
    const exactText = options.find((o) => normalizeOption(o.textContent) === targetNorm);
    if (exactText) return exactText.value;
    return null;
  }

  function waitForSelectOption(selectEl, desired, timeoutMs = 800) {
    const immediate = findSelectOptionValue(selectEl, desired);
    if (immediate !== null) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve(val);
      };
      const observer = new MutationObserver(() => {
        const found = findSelectOptionValue(selectEl, desired);
        if (found !== null) finish(found);
      });
      observer.observe(selectEl, {childList: true, subtree: true});
      const timer = setTimeout(() => finish(findSelectOptionValue(selectEl, desired)), timeoutMs);
    });
  }

  function isCascadingDependent(item) {
    const keyHint = `${item.sourceProperty || ''} ${item.fieldLabel || ''}`.toLowerCase();
    return keyHint.includes('upazila') || keyHint.includes('thana') || keyHint.includes('police station');
  }

  function isCascadingParent(item) {
    const keyHint = `${item.sourceProperty || ''} ${item.fieldLabel || ''}`.toLowerCase();
    return keyHint.includes('district');
  }

  async function applyApprovedFields(approvedFields) {
    let filledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const details = [];
    const guard = window.__wafaSensitiveFields;

    // Order parent dropdowns (e.g., District) before dependent AJAX dropdowns (e.g., Upazila)
    const ordered = [...approvedFields].sort((a, b) => {
      const aRank = isCascadingParent(a) ? 0 : isCascadingDependent(a) ? 2 : 1;
      const bRank = isCascadingParent(b) ? 0 : isCascadingDependent(b) ? 2 : 1;
      return aRank - bRank;
    });

    for (const item of ordered) {
      const el = document.querySelector(`[data-wafa-key="${CSS.escape(item.elementKey)}"]`);
      if (!el) {
        failedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, status: 'failed', reason: 'Element no longer in DOM'});
        continue;
      }

      const tag = el.tagName.toLowerCase();
      const type = tag === 'input' ? (el.type || 'text').toLowerCase() : tag;

      // Independent second-layer security boundary inside autofill runner (never trusts caller alone)
      const classification = guard
        ? guard.classifyDomControl(el)
        : {sensitive: type === 'password' || type === 'file', reason: 'Blocked protected control'};

      if (classification.sensitive) {
        failedCount += 1;
        details.push({
          elementKey: item.elementKey,
          ok: false,
          status: 'blocked',
          reason: classification.reason || 'Blocked protected control',
        });
        continue;
      }

      if (el.disabled || el.readOnly) {
        skippedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, status: 'skipped', reason: 'Control is disabled or read-only'});
        continue;
      }

      try {
        if (type === 'checkbox') {
          const desired = String(item.transformedValue).toLowerCase() === 'true';
          if (el.checked && el.checked !== desired && !item.allowOverwrite) {
            skippedCount += 1;
            details.push({
              elementKey: item.elementKey,
              ok: true,
              status: 'skipped',
              reason: 'Existing user selection preserved (overwrite not approved)',
            });
            continue;
          }
          setNativeChecked(el, desired);
          dispatchFormEvents(el);
          const verified = el.checked === desired;
          verified ? (filledCount += 1) : (failedCount += 1);
          details.push({elementKey: item.elementKey, ok: verified, status: verified ? 'filled' : 'failed'});
        } else if (type === 'radio') {
          const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
          const existingChecked = Array.from(radios).find((r) => r.checked);
          if (
            existingChecked &&
            existingChecked.value.toLowerCase() !== String(item.transformedValue).toLowerCase() &&
            !item.allowOverwrite
          ) {
            skippedCount += 1;
            details.push({
              elementKey: item.elementKey,
              ok: true,
              status: 'skipped',
              reason: 'Existing user radio selection preserved (overwrite not approved)',
            });
            continue;
          }
          let matchedRadio = null;
          for (const r of radios) {
            if (r.value.toLowerCase() === String(item.transformedValue).toLowerCase()) {
              matchedRadio = r;
              break;
            }
          }
          if (matchedRadio) {
            setNativeChecked(matchedRadio, true);
            dispatchFormEvents(matchedRadio);
            filledCount += 1;
            details.push({elementKey: item.elementKey, ok: true, status: 'filled'});
          } else {
            failedCount += 1;
            details.push({elementKey: item.elementKey, ok: false, status: 'failed', reason: 'No matching radio value'});
          }
        } else if (tag === 'select') {
          const currentVal = String(el.value || '').trim();
          if (currentVal && currentVal !== String(item.transformedValue).trim() && !item.allowOverwrite) {
            skippedCount += 1;
            details.push({
              elementKey: item.elementKey,
              ok: true,
              status: 'skipped',
              reason: 'Existing user dropdown selection preserved (overwrite not approved)',
            });
            continue;
          }
          const resolvedOptionVal = await waitForSelectOption(el, item.transformedValue, 800);
          if (resolvedOptionVal === null) {
            failedCount += 1;
            details.push({
              elementKey: item.elementKey,
              ok: false,
              status: 'failed',
              reason: 'Option not present in dropdown after AJAX wait',
            });
            continue;
          }
          setNativeValue(el, resolvedOptionVal);
          dispatchFormEvents(el);
          const verified = String(el.value) === String(resolvedOptionVal);
          verified ? (filledCount += 1) : (failedCount += 1);
          details.push({
            elementKey: item.elementKey,
            ok: verified,
            status: verified ? 'filled' : 'failed',
            reason: verified ? undefined : 'Dropdown selection rejected by page script',
          });
        } else {
          const existingVal = String(el.value || '').trim();
          const desiredVal = String(item.transformedValue);
          if (existingVal && existingVal !== desiredVal && !item.allowOverwrite) {
            skippedCount += 1;
            details.push({
              elementKey: item.elementKey,
              ok: true,
              status: 'skipped',
              reason: 'Existing user value preserved (overwrite not approved)',
            });
            continue;
          }
          setNativeValue(el, desiredVal);
          dispatchFormEvents(el);
          const verified = String(el.value) === desiredVal;
          verified ? (filledCount += 1) : (failedCount += 1);
          details.push({
            elementKey: item.elementKey,
            ok: verified,
            status: verified ? 'filled' : 'failed',
            reason: verified ? undefined : 'Value rejected or reset by page script',
          });
        }
      } catch {
        failedCount += 1;
        details.push({elementKey: item.elementKey, ok: false, status: 'failed', reason: 'DOM write error'});
      }
    }

    return {filledCount, skippedCount, failedCount, details};
  }

  window.__wafaAutofillRunner = {applyApprovedFields, setNativeValue, setNativeChecked};
})();
