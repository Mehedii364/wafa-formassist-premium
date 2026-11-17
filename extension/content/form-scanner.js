// WAFA FormAssist Content Script — Bilingual DOM Form Scanner
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

  function findLabelText(el) {
    if (el.id) {
      const direct = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (direct) return direct.textContent.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    const prevCell = el.closest('td')?.previousElementSibling;
    if (prevCell) return prevCell.textContent.trim();
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || '';
  }

  function scanDocumentForms(root = document) {
    const controls = root.querySelectorAll('input, select, textarea');
    const detected = [];
    let counter = 0;

    for (const el of controls) {
      const tagName = el.tagName.toLowerCase();
      const inputType = tagName === 'input' ? (el.type || 'text').toLowerCase() : tagName;
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(inputType)) continue;
      if (el.disabled) continue;

      counter += 1;
      const key = el.getAttribute('data-wafa-key') || `wafa-el-${counter}`;
      el.setAttribute('data-wafa-key', key);

      const field = {
        elementKey: key,
        tagName,
        inputType,
        name: el.name || '',
        id: el.id || '',
        label: findLabelText(el),
        placeholder: el.getAttribute('placeholder') || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        description: el.getAttribute('title') || '',
        sectionHint: inferSectionHint(el),
        required: Boolean(el.required),
        currentValue: inputType === 'checkbox' ? String(el.checked) : String(el.value || ''),
      };

      if (tagName === 'select') {
        field.options = Array.from(el.options).map((opt) => ({
          value: opt.value,
          text: opt.textContent.trim(),
        }));
      }

      detected.push(field);
    }

    return detected;
  }

  window.__wafaFormScanner = {scanDocumentForms};
})();
