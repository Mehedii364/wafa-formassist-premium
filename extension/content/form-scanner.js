// WAFA FormAssist Content Script — Bilingual DOM Form Scanner with Independent Sensitive-Field Exclusion
(() => {
  function inferSectionHint(el) {
    const section = el.closest('[data-wafa-section], fieldset, section, table');
    if (!section) return '';
    const explicit = section.getAttribute('data-wafa-section');
    if (explicit) return explicit;
    const heading = section.querySelector('legend, h2, h3, h4, th');
    const txt = (heading?.textContent || '').toLowerCase();
    if (txt.includes('permanent') || txt.includes('স্থায়ী')) return 'permanent_address';
    if (txt.includes('present') || txt.includes('বর্তমান')) return 'present_address';
    if (txt.includes('ssc') || txt.includes('এসএসসি')) return 'ssc';
    if (txt.includes('hsc') || txt.includes('এইচএসসি')) return 'hsc';
    if (txt.includes('graduation') || txt.includes('স্নাতক')) return 'graduation';
    if (txt.includes('masters') || txt.includes('স্নাতকোত্তর')) return 'masters';
    if (txt.includes('experience') || txt.includes('employment') || txt.includes('অভিজ্ঞতা')) return 'employment';
    return 'basic';
  }

  function resolveAriaText(idsString) {
    if (!idsString) return '';
    return idsString
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ');
  }

  function findLabelText(el) {
    if (el.id) {
      const direct = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (direct) return direct.textContent.replace(/\s*\*\s*$/, '').trim();
    }
    const labelledBy = resolveAriaText(el.getAttribute('aria-labelledby') || '');
    if (labelledBy) return labelledBy.replace(/\s*\*\s*$/, '').trim();

    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach((n) => n.remove());
      const txt = clone.textContent.replace(/\s*\*\s*$/, '').trim();
      if (txt) return txt;
    }

    const prevCell = el.closest('td')?.previousElementSibling;
    if (prevCell) return prevCell.textContent.replace(/\s*\*\s*$/, '').trim();

    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.name ||
      el.id ||
      ''
    ).trim();
  }

  function scanDocumentForms(root = document) {
    const controls = root.querySelectorAll('input, select, textarea');
    const fields = [];
    let protectedSkippedCount = 0;
    let counter = 0;
    const guard = window.__wafaSensitiveFields;

    for (const el of controls) {
      const tagName = el.tagName.toLowerCase();
      const inputType = tagName === 'input' ? (el.type || 'text').toLowerCase() : tagName;
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) continue;
      if (el.disabled || el.readOnly) continue;

      const label = findLabelText(el);
      const describedBy = resolveAriaText(el.getAttribute('aria-describedby') || '');

      // Independent sensitive-field exclusion boundary BEFORE capturing any metadata or value
      const classification = guard
        ? guard.classifyDomControl(el, label)
        : {sensitive: inputType === 'password' || inputType === 'file'};

      if (classification.sensitive) {
        protectedSkippedCount += 1;
        continue;
      }

      counter += 1;
      const key = el.getAttribute('data-wafa-key') || `wafa-el-${counter}`;
      el.setAttribute('data-wafa-key', key);

      const hasExistingValue =
        inputType === 'checkbox' || inputType === 'radio'
          ? Boolean(el.checked)
          : String(el.value || '').trim().length > 0;

      const field = {
        elementKey: key,
        tagName,
        inputType,
        name: el.name || '',
        id: el.id || '',
        label,
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        autocomplete: el.getAttribute('autocomplete') || '',
        describedBy,
        description: [el.getAttribute('title') || '', describedBy].filter(Boolean).join(' ').trim(),
        sectionHint: inferSectionHint(el),
        required: Boolean(el.required),
        hasExistingValue,
      };

      if (tagName === 'select') {
        field.options = Array.from(el.options).map((opt) => ({
          value: opt.value,
          text: opt.textContent.trim(),
        }));
      }

      fields.push(field);
    }

    return {fields, protectedSkippedCount};
  }

  window.__wafaFormScanner = {scanDocumentForms};
})();
