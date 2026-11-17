// WAFA FormAssist Extension Popup Controller
import {mapExtensionFields} from '../shared/field-mapper.js';
import {validateExtensionProfile} from '../shared/validator.js';

let appState = null;
let lastScannedFields = [];
let currentMappings = [];

const elSiteStatus = document.getElementById('site-status');
const elSiteDomain = document.getElementById('site-domain');
const elSiteReason = document.getElementById('site-reason');
const elProfileSelect = document.getElementById('profile-select');
const elCompletionText = document.getElementById('completion-text');
const elCompletionBar = document.getElementById('completion-bar');
const elValidationSummary = document.getElementById('validation-summary');
const elBtnScan = document.getElementById('btn-scan');
const elBtnPreview = document.getElementById('btn-preview');
const elBtnApply = document.getElementById('btn-apply');
const elPreviewPanel = document.getElementById('preview-panel');
const elPreviewCounts = document.getElementById('preview-counts');
const elPreviewList = document.getElementById('preview-list');
const elReportPanel = document.getElementById('report-panel');
const elReportSummary = document.getElementById('report-summary');
const elErrorBanner = document.getElementById('error-banner');
const elBtnDashboard = document.getElementById('btn-dashboard');
const elBtnSettings = document.getElementById('btn-settings');

function showError(msg) {
  if (!msg) {
    elErrorBanner.classList.add('hidden');
    elErrorBanner.textContent = '';
    return;
  }
  elErrorBanner.textContent = msg;
  elErrorBanner.classList.remove('hidden');
}

function getActiveBundle() {
  const vault = appState?.vault || {profiles: [], addresses: [], educations: [], employments: []};
  const selectedId = elProfileSelect.value;
  const profile = vault.profiles.find((p) => p.id === selectedId) || vault.profiles[0] || null;
  if (!profile) return null;
  return {
    profile,
    presentAddress: vault.addresses.find((a) => a.profileId === profile.id && a.addressType === 'present'),
    permanentAddress: vault.addresses.find((a) => a.profileId === profile.id && a.addressType === 'permanent'),
    educations: vault.educations.filter((e) => e.profileId === profile.id),
    employments: vault.employments.filter((e) => e.profileId === profile.id),
  };
}

function renderProfileSummary() {
  const bundle = getActiveBundle();
  if (!bundle) {
    elCompletionText.textContent = '0%';
    elCompletionBar.style.width = '0%';
    elValidationSummary.textContent =
      'No profiles in local extension vault. Open Settings to import an encrypted backup from Dashboard.';
    return;
  }
  const val = validateExtensionProfile(bundle.profile, [bundle.presentAddress, bundle.permanentAddress].filter(Boolean), bundle.educations);
  elCompletionText.textContent = `${val.completionPercent}%`;
  elCompletionBar.style.width = `${val.completionPercent}%`;
  elValidationSummary.textContent =
    val.issues.length === 0
      ? 'Validation: All core fields ready.'
      : `Validation: ${val.issues.length} item(s) need attention — ${val.issues[0]}`;
}

function renderPreview() {
  elPreviewList.innerHTML = '';
  const selectedCount = currentMappings.filter((m) => m.selectedForFill).length;
  elPreviewCounts.textContent = `${selectedCount} approved · ${currentMappings.length} scanned`;
  elBtnApply.disabled = selectedCount === 0;

  for (const m of currentMappings) {
    const row = document.createElement('div');
    row.className = 'preview-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = m.selectedForFill;
    checkbox.disabled = m.status === 'UNSUPPORTED' || !m.transformedValue;
    checkbox.addEventListener('change', () => {
      m.selectedForFill = checkbox.checked;
      const count = currentMappings.filter((x) => x.selectedForFill).length;
      elPreviewCounts.textContent = `${count} approved · ${currentMappings.length} scanned`;
      elBtnApply.disabled = count === 0;
    });

    const lbl = document.createElement('label');
    const title = document.createElement('div');
    title.className = 'preview-title';
    title.textContent = `${m.fieldLabel} (${m.confidence})`;

    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.textContent = m.transformedValue
      ? `Value: ${m.transformedValue} · ${m.status}`
      : `${m.status} · ${m.matchReason}`;

    lbl.appendChild(title);
    lbl.appendChild(meta);
    row.appendChild(checkbox);
    row.appendChild(lbl);
    elPreviewList.appendChild(row);
  }
}

async function init() {
  showError('');
  const [stateRes, tabRes] = await Promise.all([
    chrome.runtime.sendMessage({type: 'WAFA_GET_STATE'}),
    chrome.runtime.sendMessage({type: 'WAFA_VERIFY_ACTIVE_TAB'}),
  ]);

  if (!stateRes?.ok) {
    showError('Could not load local extension storage.');
    return;
  }
  appState = stateRes;

  const profiles = appState.vault?.profiles || [];
  elProfileSelect.innerHTML = '';
  if (profiles.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No profiles imported yet';
    elProfileSelect.appendChild(opt);
  } else {
    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.profileName} (${p.personalInformation?.applicantName || 'Unnamed'})`;
      if (p.id === appState.settings?.activeProfileId || p.isDefault) {
        opt.selected = true;
      }
      elProfileSelect.appendChild(opt);
    }
  }
  renderProfileSummary();

  const ver = tabRes?.verification;
  if (ver?.supported) {
    elSiteStatus.textContent = 'Supported';
    elSiteStatus.classList.remove('unsupported');
    elSiteDomain.textContent = `${ver.domain}${ver.route}`;
    elSiteReason.textContent = ver.reason;
    elBtnScan.disabled = profiles.length === 0;
  } else {
    elSiteStatus.textContent = 'Unsupported';
    elSiteStatus.classList.add('unsupported');
    elSiteDomain.textContent = ver?.domain || 'Unknown tab';
    elSiteReason.textContent = ver?.reason || 'Open a supported recruitment portal route.';
    elBtnScan.disabled = true;
  }
}

elProfileSelect.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({
    type: 'WAFA_SAVE_SETTINGS',
    payload: {activeProfileId: elProfileSelect.value},
  });
  renderProfileSummary();
});

elBtnScan.addEventListener('click', async () => {
  showError('');
  const res = await chrome.runtime.sendMessage({type: 'WAFA_SCAN_ACTIVE_TAB'});
  if (!res?.ok) {
    showError(`Scan failed: ${res?.error || 'Could not reach content script on this tab.'}`);
    return;
  }
  lastScannedFields = res.fields || [];
  const bundle = getActiveBundle();
  if (!bundle) {
    showError('Select or import a profile first.');
    return;
  }
  currentMappings = mapExtensionFields(
    lastScannedFields,
    bundle,
    Boolean(appState?.settings?.allowMediumConfidenceProposal),
  );
  elBtnPreview.disabled = false;
  elPreviewPanel.classList.remove('hidden');
  renderPreview();
});

elBtnPreview.addEventListener('click', () => {
  elPreviewPanel.classList.toggle('hidden');
});

elBtnApply.addEventListener('click', async () => {
  showError('');
  const bundle = getActiveBundle();
  const approvedFields = currentMappings.filter((m) => m.selectedForFill && m.transformedValue);
  const skippedCount = currentMappings.filter((m) => !m.selectedForFill && m.status !== 'MANUAL' && m.status !== 'UNRESOLVED_DROPDOWN').length;
  const unresolvedCount = currentMappings.filter((m) => m.status === 'MANUAL' || m.status === 'UNRESOLVED_DROPDOWN').length;

  const res = await chrome.runtime.sendMessage({
    type: 'WAFA_EXECUTE_AUTOFILL',
    payload: {
      profileId: bundle?.profile?.id,
      profileName: bundle?.profile?.profileName,
      scannedCount: lastScannedFields.length,
      skippedCount,
      unresolvedCount,
      approvedFields,
    },
  });

  if (!res?.ok) {
    showError(`Autofill error: ${res?.error || 'Execution blocked'}`);
    return;
  }
  elReportPanel.classList.remove('hidden');
  elReportSummary.textContent = `Filled & Verified: ${res.result.filledCount} · Skipped: ${skippedCount} · Unresolved: ${unresolvedCount} · Failed: ${res.result.failedCount}`;
});

elBtnDashboard.addEventListener('click', () => {
  const url = appState?.settings?.dashboardUrl || 'http://localhost:3000';
  chrome.tabs.create({url});
});

elBtnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
