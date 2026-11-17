// WAFA FormAssist Extension Popup Controller — Encrypted Vault + Safe User-Approved Autofill
import {mapExtensionFields} from '../shared/field-mapper.js';
import {validateExtensionProfile} from '../shared/validator.js';

let appState = null;
let activeTabVerification = null;
let scannedTabId = null;
let lastScannedFields = [];
let lastProtectedSkippedCount = 0;
let currentMappings = [];

const elVaultBadge = document.getElementById('vault-badge');
const elBtnLock = document.getElementById('btn-lock');
const elSiteStatus = document.getElementById('site-status');
const elSiteDomain = document.getElementById('site-domain');
const elSiteReason = document.getElementById('site-reason');
const elLockPanel = document.getElementById('lock-panel');
const elLockTitle = document.getElementById('lock-title');
const elLockDesc = document.getElementById('lock-desc');
const elVaultPassphrase = document.getElementById('vault-passphrase');
const elBtnUnlock = document.getElementById('btn-unlock');
const elUnlockedArea = document.getElementById('unlocked-area');
const elProfileSelect = document.getElementById('profile-select');
const elCompletionText = document.getElementById('completion-text');
const elCompletionBar = document.getElementById('completion-bar');
const elValidationSummary = document.getElementById('validation-summary');
const elBtnScan = document.getElementById('btn-scan');
const elBtnPreview = document.getElementById('btn-preview');
const elBtnApply = document.getElementById('btn-apply');
const elPreviewPanel = document.getElementById('preview-panel');
const elPreviewCounts = document.getElementById('preview-counts');
const elProtectedNote = document.getElementById('protected-note');
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
  const vault = appState?.vault;
  if (!vault) return null;
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
      'No profiles in encrypted extension vault. Open Settings to import an encrypted backup from Dashboard.';
    return;
  }
  const val = validateExtensionProfile(
    bundle.profile,
    [bundle.presentAddress, bundle.permanentAddress].filter(Boolean),
    bundle.educations,
  );
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

  if (lastProtectedSkippedCount > 0) {
    elProtectedNote.textContent = `Security guard excluded ${lastProtectedSkippedCount} protected field(s) (CAPTCHA / OTP / password / file / payment).`;
    elProtectedNote.classList.remove('hidden');
  } else {
    elProtectedNote.classList.add('hidden');
  }

  for (const m of currentMappings) {
    const row = document.createElement('div');
    row.className = 'preview-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = m.selectedForFill;
    checkbox.disabled = m.status === 'UNSUPPORTED' || !m.transformedValue;
    checkbox.addEventListener('change', () => {
      m.selectedForFill = checkbox.checked;
      if (m.requiresOverwriteApproval) {
        m.allowOverwrite = checkbox.checked;
      }
      const count = currentMappings.filter((x) => x.selectedForFill).length;
      elPreviewCounts.textContent = `${count} approved · ${currentMappings.length} scanned`;
      elBtnApply.disabled = count === 0;
    });

    const lbl = document.createElement('label');
    const title = document.createElement('div');
    title.className = 'preview-title';
    title.textContent = `${m.fieldLabel} (${m.confidence}${m.matchTier ? ` · T${m.matchTier}` : ''})`;

    const meta = document.createElement('div');
    meta.className = m.requiresOverwriteApproval ? 'preview-meta warn-meta' : 'preview-meta';
    meta.textContent = m.requiresOverwriteApproval
      ? `Existing value detected — check to overwrite with "${m.transformedValue}"`
      : m.transformedValue
        ? `Value: ${m.transformedValue} · ${m.status}`
        : `${m.status} · ${m.matchReason}`;

    lbl.appendChild(title);
    lbl.appendChild(meta);
    row.appendChild(checkbox);
    row.appendChild(lbl);
    elPreviewList.appendChild(row);
  }
}

function renderVaultUi() {
  const status = appState?.vaultStatus || {initialized: false, unlocked: false};
  if (!status.unlocked) {
    elVaultBadge.textContent = status.initialized ? 'Locked' : 'Not Set Up';
    elBtnLock.classList.add('hidden');
    elUnlockedArea.classList.add('hidden');
    elLockPanel.classList.remove('hidden');
    elLockTitle.textContent = status.initialized
      ? 'Vault Locked (AES-GCM-256)'
      : 'Initialize Encrypted Vault';
    elLockDesc.textContent = status.initialized
      ? 'Enter your vault passphrase to decrypt profiles into temporary memory.'
      : 'Create a strong local passphrase (min 8 chars) to encrypt all extension profile data at rest.';
    elBtnUnlock.textContent = status.initialized ? 'Unlock Vault' : 'Create Encrypted Vault';
    return;
  }

  elVaultBadge.textContent = 'Unlocked';
  elBtnLock.classList.remove('hidden');
  elLockPanel.classList.add('hidden');
  elUnlockedArea.classList.remove('hidden');

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
  elBtnScan.disabled = !activeTabVerification?.supported || profiles.length === 0;
}

async function init() {
  showError('');
  const [stateRes, tabRes] = await Promise.all([
    chrome.runtime.sendMessage({type: 'WAFA_GET_STATE'}),
    chrome.runtime.sendMessage({type: 'WAFA_VERIFY_ACTIVE_TAB'}),
  ]);

  if (!stateRes?.ok) {
    showError(`Could not load local extension storage: ${stateRes?.error || 'UNKNOWN'}`);
    return;
  }
  appState = stateRes;
  activeTabVerification = tabRes?.verification || null;

  if (activeTabVerification?.supported) {
    elSiteStatus.textContent = 'Supported';
    elSiteStatus.classList.remove('unsupported');
    elSiteDomain.textContent = `${activeTabVerification.domain}${activeTabVerification.route}`;
    elSiteReason.textContent = activeTabVerification.reason;
  } else {
    elSiteStatus.textContent = 'Unsupported';
    elSiteStatus.classList.add('unsupported');
    elSiteDomain.textContent = activeTabVerification?.domain || 'Unknown tab';
    elSiteReason.textContent = activeTabVerification?.reason || 'Open a supported recruitment portal route.';
  }

  renderVaultUi();
}

elBtnUnlock.addEventListener('click', async () => {
  showError('');
  const pass = elVaultPassphrase.value;
  if (!pass || pass.length < 8) {
    showError('Passphrase must be at least 8 characters.');
    return;
  }
  const initialized = Boolean(appState?.vaultStatus?.initialized);
  const res = await chrome.runtime.sendMessage({
    type: initialized ? 'WAFA_UNLOCK_VAULT' : 'WAFA_SETUP_VAULT',
    payload: {passphrase: pass},
  });
  elVaultPassphrase.value = '';
  if (!res?.ok) {
    if (res?.error === 'UNLOCK_RATE_LIMITED') {
      showError(`Too many failed attempts. Try again in ${res.retryAfterSeconds}s.`);
    } else {
      showError('Incorrect passphrase or vault unlock failed.');
    }
    return;
  }
  await init();
});

elBtnLock.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type: 'WAFA_LOCK_VAULT'});
  lastScannedFields = [];
  currentMappings = [];
  elPreviewPanel.classList.add('hidden');
  elReportPanel.classList.add('hidden');
  await init();
});

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
    if (res?.error === 'VAULT_LOCKED') {
      await init();
      return;
    }
    showError(`Scan failed: ${res?.error || 'Could not reach content script on this tab.'}`);
    return;
  }
  scannedTabId = res.tabId || null;
  lastScannedFields = res.fields || [];
  lastProtectedSkippedCount = Number(res.protectedSkippedCount || 0);
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
  const approvedFields = currentMappings
    .filter((m) => m.selectedForFill && m.transformedValue)
    .map((m) => ({
      elementKey: m.elementKey,
      fieldLabel: m.fieldLabel,
      sourceProperty: m.sourceProperty,
      transformedValue: m.transformedValue,
      allowOverwrite: Boolean(m.allowOverwrite),
    }));
  const skippedCount = currentMappings.filter(
    (m) => !m.selectedForFill && m.status !== 'MANUAL' && m.status !== 'UNRESOLVED_DROPDOWN',
  ).length;
  const unresolvedCount = currentMappings.filter(
    (m) => m.status === 'MANUAL' || m.status === 'UNRESOLVED_DROPDOWN',
  ).length;

  const res = await chrome.runtime.sendMessage({
    type: 'WAFA_EXECUTE_AUTOFILL',
    payload: {
      tabId: scannedTabId,
      profileId: bundle?.profile?.id,
      profileName: bundle?.profile?.profileName,
      scannedCount: lastScannedFields.length,
      skippedCount,
      unresolvedCount,
      protectedSkippedCount: lastProtectedSkippedCount,
      approvedFields,
    },
  });

  if (!res?.ok) {
    if (res?.error === 'VAULT_LOCKED') {
      await init();
      return;
    }
    showError(`Autofill error: ${res?.error || 'Execution blocked'}`);
    return;
  }
  elReportPanel.classList.remove('hidden');
  const totalSkipped = skippedCount + Number(res.result?.skippedCount || 0);
  elReportSummary.textContent = `Filled & Verified: ${res.result.filledCount} · Skipped: ${totalSkipped} · Unresolved: ${unresolvedCount} · Failed: ${res.result.failedCount}`;
});

elBtnDashboard.addEventListener('click', () => {
  const url = appState?.settings?.dashboardUrl || 'http://localhost:3000';
  chrome.tabs.create({url});
});

elBtnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
