import React, {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {BD_DISTRICTS, findDistrictEntry} from '../../shared/constants/bd-locations';
import {DetectedFormField, FieldMappingResult} from '../../shared/schemas/types';
import {classifySensitiveField} from '../../shared/security/sensitive-fields';

export interface SimulatedFormHandle {
  scanDomFields: () => {
    fields: DetectedFormField[];
    protectedSkippedCount: number;
  };
  applyApprovedMappings: (approved: FieldMappingResult[]) => {
    filledCount: number;
    skippedCount: number;
    failedCount: number;
    details: Array<{
      elementKey: string;
      fieldLabel: string;
      ok: boolean;
      skipped?: boolean;
      reason?: string;
    }>;
  };
  resetForm: () => void;
}

function setNativeControlValue(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && typeof descriptor.set === 'function') {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
}

function setNativeCheckboxChecked(el: HTMLInputElement, checked: boolean): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
  if (descriptor && typeof descriptor.set === 'function') {
    descriptor.set.call(el, checked);
  } else {
    el.checked = checked;
  }
}

function resolveDescribedByText(form: HTMLFormElement, el: HTMLElement): string {
  const ids = (el.getAttribute('aria-describedby') || '').trim().split(/\s+/).filter(Boolean);
  if (!ids.length) return '';
  return ids
    .map((id) => form.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim() || '')
    .filter(Boolean)
    .join(' ');
}

/**
 * Real DOM-backed simulated Bangladesh Post Office DGBPO 2026 application form.
 * Every input, select, checkbox, and textarea is scanned directly from the live DOM,
 * sensitive fields are independently excluded before capture or write, existing manual
 * values are preserved unless explicitly approved for overwrite, and values are verified post-fill.
 */
export const SimulatedDgbpoForm = forwardRef<SimulatedFormHandle>((_props, ref) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [presentDistrict, setPresentDistrict] = useState('');
  const [permanentDistrict, setPermanentDistrict] = useState('');
  const [sameAsPresent, setSameAsPresent] = useState(false);

  const presentUpazilas = findDistrictEntry(presentDistrict)?.upazilas || [];
  const permanentUpazilas = findDistrictEntry(permanentDistrict)?.upazilas || [];

  useImperativeHandle(ref, () => ({
    scanDomFields: () => {
      const form = formRef.current;
      if (!form) return {fields: [], protectedSkippedCount: 0};
      const controls = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea',
      );
      const detected: DetectedFormField[] = [];
      let protectedSkippedCount = 0;
      let idx = 0;

      for (const el of controls) {
        const tagName = el.tagName.toLowerCase() as 'input' | 'select' | 'textarea';
        const inputType = tagName === 'input' ? (el.type || 'text').toLowerCase() : tagName;
        if (['hidden', 'submit', 'button', 'reset'].includes(inputType)) continue;

        const labelEl = el.id ? form.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
        const labelText = (labelEl?.textContent || el.getAttribute('aria-label') || el.name || '')
          .replace(/\s*\*\s*$/, '')
          .trim();
        const autocomplete = el.getAttribute('autocomplete') || '';
        const describedBy = resolveDescribedByText(form, el);
        const placeholder = el.getAttribute('placeholder') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';

        // Independent sensitive-field exclusion BEFORE ever reading el.value
        const sensitiveDecision = classifySensitiveField({
          tagName,
          inputType,
          autocomplete,
          name: el.name || '',
          id: el.id || '',
          label: labelText,
          placeholder,
          ariaLabel,
          describedBy,
        });
        if (sensitiveDecision.sensitive) {
          protectedSkippedCount += 1;
          continue;
        }

        idx += 1;
        const key = el.getAttribute('data-wafa-key') || `sim-field-${idx}`;
        el.setAttribute('data-wafa-key', key);
        const sectionEl = el.closest('[data-wafa-section]');

        const currentValue =
          inputType === 'checkbox'
            ? String((el as HTMLInputElement).checked)
            : String(el.value || '');
        const hasExistingValue =
          inputType === 'checkbox' ? (el as HTMLInputElement).checked : Boolean(currentValue.trim());

        const item: DetectedFormField = {
          elementKey: key,
          tagName,
          inputType,
          name: el.name || '',
          id: el.id || '',
          label: labelText,
          placeholder,
          ariaLabel,
          autocomplete,
          describedBy,
          description: el.getAttribute('title') || describedBy,
          sectionHint: sectionEl?.getAttribute('data-wafa-section') || 'basic',
          required: Boolean(el.required),
          hasExistingValue,
          currentValue,
        };

        if (tagName === 'select') {
          item.options = Array.from((el as HTMLSelectElement).options).map((o) => ({
            value: o.value,
            text: o.textContent?.trim() || '',
          }));
        }
        detected.push(item);
      }
      return {fields: detected, protectedSkippedCount};
    },

    applyApprovedMappings: (approved) => {
      const form = formRef.current;
      if (!form) return {filledCount: 0, skippedCount: 0, failedCount: approved.length, details: []};
      let filledCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const details: Array<{
        elementKey: string;
        fieldLabel: string;
        ok: boolean;
        skipped?: boolean;
        reason?: string;
      }> = [];

      for (const m of approved) {
        const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          `[data-wafa-key="${CSS.escape(m.elementKey)}"]`,
        );
        if (!el) {
          failedCount += 1;
          details.push({elementKey: m.elementKey, fieldLabel: m.fieldLabel, ok: false, reason: 'Element missing'});
          continue;
        }
        const tag = el.tagName.toLowerCase();
        const type = tag === 'input' ? (el as HTMLInputElement).type.toLowerCase() : tag;
        const labelEl = el.id ? form.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;

        // Independent sensitive-field exclusion at write time
        const sensitiveDecision = classifySensitiveField({
          tagName: tag,
          inputType: type,
          autocomplete: el.getAttribute('autocomplete') || '',
          name: el.name || '',
          id: el.id || '',
          label: labelEl?.textContent || m.fieldLabel,
          placeholder: el.getAttribute('placeholder') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
        });
        if (sensitiveDecision.sensitive) {
          failedCount += 1;
          details.push({
            elementKey: m.elementKey,
            fieldLabel: m.fieldLabel,
            ok: false,
            reason: `Protected field (${sensitiveDecision.category})`,
          });
          continue;
        }

        if (type === 'checkbox') {
          const desired = m.transformedValue === 'true';
          const currentChecked = (el as HTMLInputElement).checked;
          if (currentChecked && currentChecked !== desired && !m.allowOverwrite) {
            skippedCount += 1;
            details.push({
              elementKey: m.elementKey,
              fieldLabel: m.fieldLabel,
              ok: true,
              skipped: true,
              reason: 'Existing checked state preserved',
            });
            continue;
          }
          setNativeCheckboxChecked(el as HTMLInputElement, desired);
          if (el.id === 'sim_same_as_present') setSameAsPresent(desired);
          el.dispatchEvent(new Event('change', {bubbles: true}));
          const ok = (el as HTMLInputElement).checked === desired;
          if (ok) filledCount += 1;
          else failedCount += 1;
          details.push({elementKey: m.elementKey, fieldLabel: m.fieldLabel, ok});
        } else {
          const existingVal = String(el.value || '').trim();
          if (existingVal && existingVal !== m.transformedValue.trim() && !m.allowOverwrite) {
            skippedCount += 1;
            details.push({
              elementKey: m.elementKey,
              fieldLabel: m.fieldLabel,
              ok: true,
              skipped: true,
              reason: 'Existing user value preserved (overwrite not approved)',
            });
            continue;
          }

          if (el.id === 'sim_present_district') setPresentDistrict(m.transformedValue);
          if (el.id === 'sim_permanent_district') setPermanentDistrict(m.transformedValue);

          setNativeControlValue(el, m.transformedValue);
          el.dispatchEvent(new Event('input', {bubbles: true}));
          el.dispatchEvent(new Event('change', {bubbles: true}));
          const ok = el.value === m.transformedValue;
          if (ok) filledCount += 1;
          else failedCount += 1;
          details.push({
            elementKey: m.elementKey,
            fieldLabel: m.fieldLabel,
            ok,
            reason: ok ? undefined : 'Option not currently present in control',
          });
        }
      }

      return {filledCount, skippedCount, failedCount, details};
    },

    resetForm: () => {
      formRef.current?.reset();
      setPresentDistrict('');
      setPermanentDistrict('');
      setSameAsPresent(false);
    },
  }));

  const inputCls =
    'mt-1 w-full rounded-md border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-2.5 py-1.5 text-xs text-[#0F1714] dark:text-[#F4F7F5]';
  const lblCls = 'block text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]';

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5"
      aria-label="Simulated DGBPO 2026 Application Form"
    >
      {/* Basic Information */}
      <fieldset
        data-wafa-section="basic"
        className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4"
      >
        <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Basic Information · মৌলিক তথ্য
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
          <div>
            <label htmlFor="sim_applicant_name" className={lblCls}>Applicant's Name *</label>
            <input id="sim_applicant_name" name="applicant_name" type="text" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_applicant_name_bn" className={lblCls}>Applicant Name in Bengali *</label>
            <input id="sim_applicant_name_bn" name="applicant_name_bn" type="text" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_father_name" className={lblCls}>Father's Name *</label>
            <input id="sim_father_name" name="father_name" type="text" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_father_name_bn" className={lblCls}>Father's Name in Bengali</label>
            <input id="sim_father_name_bn" name="father_name_bn" type="text" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_mother_name" className={lblCls}>Mother's Name *</label>
            <input id="sim_mother_name" name="mother_name" type="text" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_mother_name_bn" className={lblCls}>Mother's Name in Bengali</label>
            <input id="sim_mother_name_bn" name="mother_name_bn" type="text" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_dob" className={lblCls}>Date of Birth (DD/MM/YYYY) *</label>
            <input id="sim_dob" name="dob" type="text" placeholder="DD/MM/YYYY" required className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_nationality" className={lblCls}>Nationality *</label>
            <select id="sim_nationality" name="nationality" required className={inputCls}>
              <option value="">Select One</option>
              <option value="Bangladeshi">Bangladeshi</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim_religion" className={lblCls}>Religion *</label>
            <select id="sim_religion" name="religion" required className={inputCls}>
              <option value="">Select One</option>
              <option value="Islam">Islam</option>
              <option value="Hinduism">Hinduism</option>
              <option value="Christianity">Christianity</option>
              <option value="Buddhism">Buddhism</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim_gender" className={lblCls}>Gender *</label>
            <select id="sim_gender" name="gender" required className={inputCls}>
              <option value="">Select One</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Third Gender">Third Gender</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim_nid" className={lblCls}>National ID</label>
            <input id="sim_nid" name="national_id" type="text" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_breg" className={lblCls}>Birth Registration</label>
            <input id="sim_breg" name="birth_registration" type="text" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_passport" className={lblCls}>Passport ID</label>
            <input id="sim_passport" name="passport_id" type="text" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_marital" className={lblCls}>Marital Status *</label>
            <select id="sim_marital" name="marital_status" required className={inputCls}>
              <option value="">Select One</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim_mobile" className={lblCls}>Mobile Number *</label>
            <input id="sim_mobile" name="mobile_number" type="tel" required className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_confirm_mobile" className={lblCls}>Confirm Mobile Number *</label>
            <input id="sim_confirm_mobile" name="confirm_mobile_number" type="tel" required className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label htmlFor="sim_email" className={lblCls}>Email</label>
            <input id="sim_email" name="email" type="email" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_quota" className={lblCls}>Quota *</label>
            <select id="sim_quota" name="quota" required className={inputCls}>
              <option value="">Select One</option>
              <option value="Non Quota">Non Quota</option>
              <option value="Freedom Fighter">Freedom Fighter</option>
              <option value="Physically Handicapped">Physically Handicapped</option>
              <option value="Orphan">Orphan</option>
              <option value="Ethnic Minority">Ethnic Minority</option>
              <option value="Ansar-VDP">Ansar-VDP</option>
            </select>
          </div>
          <div>
            <label htmlFor="sim_dep_status" className={lblCls}>Departmental Status</label>
            <select id="sim_dep_status" name="departmental_status" className={inputCls}>
              <option value="">Select One</option>
              <option value="None">None</option>
              <option value="Govt. Employee">Govt. Employee</option>
              <option value="Semi Govt. Employee">Semi Govt. Employee</option>
              <option value="Autonomous">Autonomous</option>
              <option value="Departmental Candidate">Departmental Candidate</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Present & Permanent Address */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <fieldset
          data-wafa-section="present_address"
          className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4 space-y-2.5"
        >
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Present Address · বর্তমান ঠিকানা
          </legend>
          <div>
            <label htmlFor="sim_present_co" className={lblCls}>Care Of</label>
            <input id="sim_present_co" name="present_careof" type="text" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_present_village" className={lblCls}>Village / Road / House / Flat</label>
            <input id="sim_present_village" name="present_village" type="text" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="sim_present_district" className={lblCls}>District</label>
              <select
                id="sim_present_district"
                name="present_district"
                value={presentDistrict}
                onChange={(e) => setPresentDistrict(e.target.value)}
                className={inputCls}
              >
                <option value="">Select District</option>
                {BD_DISTRICTS.map((d) => (
                  <option key={d.district} value={d.district}>{d.district}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sim_present_upazila" className={lblCls}>Upazila / P.S.</label>
              <input
                id="sim_present_upazila"
                name="present_upazila"
                list="sim-present-upazilas"
                type="text"
                className={inputCls}
              />
              <datalist id="sim-present-upazilas">
                {presentUpazilas.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="sim_present_post" className={lblCls}>Post Office</label>
              <input id="sim_present_post" name="present_post" type="text" className={inputCls} />
            </div>
            <div>
              <label htmlFor="sim_present_postcode" className={lblCls}>Post Code</label>
              <input id="sim_present_postcode" name="present_postcode" type="text" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </fieldset>

        <fieldset
          data-wafa-section="permanent_address"
          className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4 space-y-2.5"
        >
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Permanent Address · স্থায়ী ঠিকানা
          </legend>
          <label htmlFor="sim_same_as_present" className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              id="sim_same_as_present"
              name="same_as_present"
              type="checkbox"
              checked={sameAsPresent}
              onChange={(e) => setSameAsPresent(e.target.checked)}
              className="rounded border-[#26362F]"
            />
            Same as Present Address
          </label>
          <div>
            <label htmlFor="sim_perm_co" className={lblCls}>Care Of</label>
            <input id="sim_perm_co" name="permanent_careof" type="text" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_perm_village" className={lblCls}>Village / Road / House / Flat</label>
            <input id="sim_perm_village" name="permanent_village" type="text" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="sim_permanent_district" className={lblCls}>District</label>
              <select
                id="sim_permanent_district"
                name="permanent_district"
                value={permanentDistrict}
                onChange={(e) => setPermanentDistrict(e.target.value)}
                className={inputCls}
              >
                <option value="">Select District</option>
                {BD_DISTRICTS.map((d) => (
                  <option key={d.district} value={d.district}>{d.district}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sim_perm_upazila" className={lblCls}>Upazila / P.S.</label>
              <input
                id="sim_perm_upazila"
                name="permanent_upazila"
                list="sim-perm-upazilas"
                type="text"
                className={inputCls}
              />
              <datalist id="sim-perm-upazilas">
                {permanentUpazilas.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="sim_perm_post" className={lblCls}>Post Office</label>
              <input id="sim_perm_post" name="permanent_post" type="text" className={inputCls} />
            </div>
            <div>
              <label htmlFor="sim_perm_postcode" className={lblCls}>Post Code</label>
              <input id="sim_perm_postcode" name="permanent_postcode" type="text" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Education Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <fieldset data-wafa-section="ssc" className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4">
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">SSC / Equivalent</legend>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div>
              <label htmlFor="sim_ssc_exam" className={lblCls}>Examination</label>
              <select id="sim_ssc_exam" name="ssc_exam" className={inputCls}>
                <option value="">Select</option>
                <option value="SSC">SSC</option>
                <option value="Dakhil">Dakhil</option>
                <option value="SSC Vocational">SSC Vocational</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_ssc_roll" className={lblCls}>Roll Number</label>
              <input id="sim_ssc_roll" name="ssc_roll" type="text" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="sim_ssc_group" className={lblCls}>Group / Subject</label>
              <select id="sim_ssc_group" name="ssc_group" className={inputCls}>
                <option value="">Select</option>
                <option value="Science">Science</option>
                <option value="Business Studies">Business Studies</option>
                <option value="Humanities">Humanities</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_ssc_board" className={lblCls}>Board</label>
              <select id="sim_ssc_board" name="ssc_board" className={inputCls}>
                <option value="">Select</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Chattogram">Chattogram</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Comilla">Comilla</option>
                <option value="Jessore">Jessore</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Dinajpur">Dinajpur</option>
                <option value="Barishal">Barishal</option>
                <option value="Mymensingh">Mymensingh</option>
                <option value="Madrasah">Madrasah</option>
                <option value="Technical">Technical</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_ssc_result" className={lblCls}>Result</label>
              <input id="sim_ssc_result" name="ssc_result" type="text" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="sim_ssc_year" className={lblCls}>Passing Year</label>
              <input id="sim_ssc_year" name="ssc_year" type="text" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </fieldset>

        <fieldset data-wafa-section="hsc" className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4">
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">HSC / Equivalent</legend>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div>
              <label htmlFor="sim_hsc_exam" className={lblCls}>Examination</label>
              <select id="sim_hsc_exam" name="hsc_exam" className={inputCls}>
                <option value="">Select</option>
                <option value="HSC">HSC</option>
                <option value="Alim">Alim</option>
                <option value="HSC Vocational">HSC Vocational</option>
                <option value="Diploma">Diploma</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_hsc_roll" className={lblCls}>Roll Number</label>
              <input id="sim_hsc_roll" name="hsc_roll" type="text" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="sim_hsc_group" className={lblCls}>Group / Subject</label>
              <select id="sim_hsc_group" name="hsc_group" className={inputCls}>
                <option value="">Select</option>
                <option value="Science">Science</option>
                <option value="Business Studies">Business Studies</option>
                <option value="Humanities">Humanities</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_hsc_board" className={lblCls}>Board</label>
              <select id="sim_hsc_board" name="hsc_board" className={inputCls}>
                <option value="">Select</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Chattogram">Chattogram</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Comilla">Comilla</option>
                <option value="Jessore">Jessore</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Dinajpur">Dinajpur</option>
                <option value="Barishal">Barishal</option>
                <option value="Mymensingh">Mymensingh</option>
                <option value="Madrasah">Madrasah</option>
                <option value="Technical">Technical</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim_hsc_result" className={lblCls}>Result</label>
              <input id="sim_hsc_result" name="hsc_result" type="text" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label htmlFor="sim_hsc_year" className={lblCls}>Passing Year</label>
              <input id="sim_hsc_year" name="hsc_year" type="text" className={`${inputCls} font-mono`} />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Graduation, Masters & Employment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <fieldset data-wafa-section="graduation" className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4">
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Graduation / Equivalent</legend>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div><label htmlFor="sim_grad_exam" className={lblCls}>Examination</label><input id="sim_grad_exam" name="grad_exam" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_grad_univ" className={lblCls}>University / Institution</label><input id="sim_grad_univ" name="grad_university" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_grad_subj" className={lblCls}>Subject / Degree</label><input id="sim_grad_subj" name="grad_subject" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_grad_res" className={lblCls}>Result</label><input id="sim_grad_res" name="grad_result" type="text" className={`${inputCls} font-mono`} /></div>
            <div><label htmlFor="sim_grad_year" className={lblCls}>Passing Year</label><input id="sim_grad_year" name="grad_year" type="text" className={`${inputCls} font-mono`} /></div>
            <div><label htmlFor="sim_grad_dur" className={lblCls}>Course Duration</label><input id="sim_grad_dur" name="grad_duration" type="text" className={inputCls} /></div>
          </div>
        </fieldset>

        <fieldset data-wafa-section="employment" className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-4">
          <legend className="px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Job Experience</legend>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div><label htmlFor="sim_job_desig" className={lblCls}>Designation / Post</label><input id="sim_job_desig" name="job_designation" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_job_org" className={lblCls}>Organization</label><input id="sim_job_org" name="job_organization" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_job_start" className={lblCls}>Start Date</label><input id="sim_job_start" name="job_start_date" type="date" className={`${inputCls} font-mono`} /></div>
            <div><label htmlFor="sim_job_end" className={lblCls}>End Date</label><input id="sim_job_end" name="job_end_date" type="date" className={`${inputCls} font-mono`} /></div>
            <div><label htmlFor="sim_job_len" className={lblCls}>Length of Service</label><input id="sim_job_len" name="job_length_service" type="text" className={inputCls} /></div>
            <div><label htmlFor="sim_job_addr" className={lblCls}>Organization Address</label><input id="sim_job_addr" name="job_address" type="text" className={inputCls} /></div>
          </div>
        </fieldset>
      </div>

      {/* Security Protected Fields (Proves independent exclusion works) */}
      <fieldset data-wafa-section="security" className="rounded-lg border border-amber-500/30 p-4">
        <legend className="px-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
          Security Verification (Excluded from Autofill)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
          <div>
            <label htmlFor="sim_captcha" className={lblCls}>Validation Code (CAPTCHA)</label>
            <input id="sim_captcha" name="captcha_code" type="text" placeholder="Manual entry only" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_otp" className={lblCls}>OTP Verification Code</label>
            <input id="sim_otp" name="otp_code" type="text" autoComplete="one-time-code" placeholder="Manual OTP only" className={inputCls} />
          </div>
          <div>
            <label htmlFor="sim_photo" className={lblCls}>Applicant Photo Upload</label>
            <input id="sim_photo" name="photo_upload" type="file" className={inputCls} />
          </div>
        </div>
      </fieldset>
    </form>
  );
});

SimulatedDgbpoForm.displayName = 'SimulatedDgbpoForm';
