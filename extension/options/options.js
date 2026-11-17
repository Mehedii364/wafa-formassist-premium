// WAFA FormAssist Extension Options Controller
// All sensitive vault operations are delegated to the hardened background service worker
// so derived CryptoKeys remain strictly inside service-worker memory.

const elFile = document.getElementById('backup-file');
const elBackupPass = document.getElementById('backup-passphrase');
const elVaultPass = document.getElementById('vault-passphrase');
const elVaultStatus = document.getElementById('vault-status');
const elImportStatus = document.getElementById('import-status');
const elDashboardUrl = document.getElementById('dashboard-url');
const elAutoLock = document.getElementById('autolock-minutes');
const elChkDgbpo = document.getElementById('chk-dgbpo');
const elChkMedium = document.getElementById('chk-medium');
const elSettingsStatus = document.getElementById('settings-status');
const elVaultSummary = document.getElementById('vault-summary');

let lastState = null;

async function refreshSummary() {
  const res = await chrome.runtime.sendMessage({type: 'WAFA_GET_STATE'});
  if (!res?.ok) {
    elVaultSummary.textContent = `Vault unavailable: ${res?.error || 'UNKNOWN'}`;
    return;
  }
  lastState = res;
  const {settings, vaultStatus, vault} = res;
  elDashboardUrl.value = settings.dashboardUrl || 'http://localhost:3000';
  elAutoLock.value = String(settings.autoLockMinutes || 15);
  elChkDgbpo.checked = (settings.permittedDomains || []).includes('dgbpo.teletalk.com.bd');
  elChkMedium.checked = Boolean(settings.allowMediumConfidenceProposal);

  if (!vaultStatus?.initialized) {
    elVaultSummary.textContent = 'Encrypted Vault: Not initialized yet (set a passphrase above or import a backup).';
  } else if (!vaultStatus.unlocked) {
    elVaultSummary.textContent = `Encrypted Vault: LOCKED · Stored profiles: ${vaultStatus.profileCount} · PBKDF2: ${vaultStatus.iterations} iterations`;
  } else {
    elVaultSummary.textContent =
      `Encrypted Vault: UNLOCKED · Profiles: ${vault?.profiles?.length || 0} · Addresses: ${vault?.addresses?.length || 0} · ` +
      `Education: ${vault?.educations?.length || 0} · Employment: ${vault?.employments?.length || 0}`;
  }
}

document.getElementById('btn-vault-unlock').addEventListener('click', async () => {
  elVaultStatus.textContent = '';
  const pass = elVaultPass.value;
  if (!pass || pass.length < 8) {
    elVaultStatus.textContent = 'Passphrase must be at least 8 characters.';
    return;
  }
  const initialized = Boolean(lastState?.vaultStatus?.initialized);
  const res = await chrome.runtime.sendMessage({
    type: initialized ? 'WAFA_UNLOCK_VAULT' : 'WAFA_SETUP_VAULT',
    payload: {passphrase: pass},
  });
  elVaultPass.value = '';
  if (!res?.ok) {
    elVaultStatus.textContent =
      res?.error === 'UNLOCK_RATE_LIMITED'
        ? `Too many failed attempts. Wait ${res.retryAfterSeconds}s.`
        : `Vault action failed: ${res?.error || 'Check passphrase.'}`;
    return;
  }
  elVaultStatus.textContent = initialized ? 'Vault unlocked into temporary memory.' : 'Encrypted vault created and unlocked.';
  await refreshSummary();
});

document.getElementById('btn-vault-lock').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type: 'WAFA_LOCK_VAULT'});
  elVaultStatus.textContent = 'Vault locked and memory key cleared.';
  await refreshSummary();
});

document.getElementById('btn-export-backup').addEventListener('click', async () => {
  elVaultStatus.textContent = '';
  const res = await chrome.runtime.sendMessage({type: 'WAFA_EXPORT_BACKUP'});
  if (!res?.ok) {
    elVaultStatus.textContent = `Export failed: ${res?.error || 'Unlock vault first.'}`;
    return;
  }
  const blob = new Blob([JSON.stringify(res.backupPackage, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wafa-extension-encrypted-backup-${new Date().toISOString().slice(0, 10)}.wafa.json`;
  a.click();
  URL.revokeObjectURL(url);
  elVaultStatus.textContent = 'Encrypted .wafa.json backup downloaded.';
});

document.getElementById('btn-import').addEventListener('click', async () => {
  elImportStatus.textContent = '';
  const file = elFile.files?.[0];
  if (!file) {
    elImportStatus.textContent = 'Select a .wafa.json backup file first.';
    return;
  }
  try {
    const raw = await file.text();
    const backupPackage = JSON.parse(raw);
    const res = await chrome.runtime.sendMessage({
      type: 'WAFA_IMPORT_BACKUP',
      payload: {
        backupPackage,
        backupPassphrase: elBackupPass.value || undefined,
        vaultPassphrase: elVaultPass.value || undefined,
      },
    });
    elBackupPass.value = '';
    elVaultPass.value = '';
    if (!res?.ok) {
      elImportStatus.textContent = `Import failed: ${res?.error || 'Unlock vault or enter a vault passphrase first.'}`;
      return;
    }
    elImportStatus.textContent = `Encrypted & imported ${res.summary.profileCount} profile(s) into local extension vault.`;
    await refreshSummary();
  } catch (err) {
    elImportStatus.textContent = `Import failed: ${err?.message || 'Invalid JSON backup.'}`;
  }
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const permittedDomains = elChkDgbpo.checked ? ['dgbpo.teletalk.com.bd'] : [];
  const res = await chrome.runtime.sendMessage({
    type: 'WAFA_SAVE_SETTINGS',
    payload: {
      dashboardUrl: elDashboardUrl.value.trim() || 'http://localhost:3000',
      autoLockMinutes: Number(elAutoLock.value) || 15,
      permittedDomains,
      allowMediumConfidenceProposal: elChkMedium.checked,
    },
  });
  elSettingsStatus.textContent = res?.ok
    ? 'Extension settings saved locally.'
    : `Could not save settings: ${res?.error || 'Invalid input'}`;
  await refreshSummary();
});

document.getElementById('btn-clear-vault').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({type: 'WAFA_CLEAR_VAULT'});
  elSettingsStatus.textContent = 'All extension local profiles and settings erased.';
  await refreshSummary();
});

refreshSummary();
