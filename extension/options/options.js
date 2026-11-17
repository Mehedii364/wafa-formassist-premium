// WAFA FormAssist Extension Options Controller
import {decryptEnvelope} from '../shared/crypto.js';
import {
  clearExtensionVault,
  getExtensionSettings,
  loadVaultSnapshot,
  saveExtensionSettings,
  saveVaultSnapshot,
} from '../shared/storage.js';

const elFile = document.getElementById('backup-file');
const elPassphrase = document.getElementById('backup-passphrase');
const elImportStatus = document.getElementById('import-status');
const elDashboardUrl = document.getElementById('dashboard-url');
const elChkDgbpo = document.getElementById('chk-dgbpo');
const elChkMedium = document.getElementById('chk-medium');
const elSettingsStatus = document.getElementById('settings-status');
const elVaultSummary = document.getElementById('vault-summary');

async function refreshSummary() {
  const [settings, vault] = await Promise.all([getExtensionSettings(), loadVaultSnapshot()]);
  elDashboardUrl.value = settings.dashboardUrl || 'http://localhost:3000';
  elChkDgbpo.checked = (settings.permittedDomains || []).includes('dgbpo.teletalk.com.bd');
  elChkMedium.checked = Boolean(settings.allowMediumConfidenceProposal);
  elVaultSummary.textContent =
    `Profiles: ${vault.profiles?.length || 0} · Addresses: ${vault.addresses?.length || 0} · ` +
    `Education: ${vault.educations?.length || 0} · Employment: ${vault.employments?.length || 0}`;
}

document.getElementById('btn-import').addEventListener('click', async () => {
  elImportStatus.textContent = '';
  const file = elFile.files?.[0];
  if (!file) {
    elImportStatus.textContent = 'Select a .wafa.json backup file first.';
    return;
  }
  try {
    const raw = await file.text();
    const pkg = JSON.parse(raw);
    if (pkg.format !== 'WAFA_FORMASSIST_BACKUP') {
      throw new Error('Not a valid WAFA FormAssist backup file.');
    }
    let snapshot;
    if (pkg.encrypted) {
      const pass = elPassphrase.value;
      if (!pass) throw new Error('Passphrase required to decrypt this backup.');
      snapshot = await decryptEnvelope(pkg.envelope, pass);
    } else {
      snapshot = pkg.payload;
    }
    await saveVaultSnapshot(snapshot);
    elPassphrase.value = '';
    elImportStatus.textContent = `Imported ${snapshot.profiles?.length || 0} profile(s) into local extension vault.`;
    await refreshSummary();
  } catch (err) {
    elImportStatus.textContent = `Import failed: ${err?.message || 'Decryption or integrity check failed.'}`;
  }
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const permittedDomains = elChkDgbpo.checked ? ['dgbpo.teletalk.com.bd'] : [];
  await saveExtensionSettings({
    dashboardUrl: elDashboardUrl.value.trim() || 'http://localhost:3000',
    permittedDomains,
    allowMediumConfidenceProposal: elChkMedium.checked,
  });
  elSettingsStatus.textContent = 'Extension settings saved locally.';
  await refreshSummary();
});

document.getElementById('btn-clear-vault').addEventListener('click', async () => {
  await clearExtensionVault();
  elSettingsStatus.textContent = 'All extension local profiles and settings erased.';
  await refreshSummary();
});

refreshSummary();
