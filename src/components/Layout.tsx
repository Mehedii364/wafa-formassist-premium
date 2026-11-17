import React, {useState} from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Cloud,
  CloudOff,
  DatabaseBackup,
  Globe,
  GraduationCap,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  MapPin,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  User,
  Wand2,
  X,
} from 'lucide-react';
import {NavPageId, useApp} from '../context/AppContext';
import {PWAInstallButton} from './PWAInstallButton';

interface NavGroup {
  groupKey: 'workspace' | 'records' | 'automation' | 'system';
  items: Array<{id: NavPageId; icon: React.ComponentType<{className?: string}>}>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'workspace',
    items: [{id: 'overview', icon: LayoutDashboard}],
  },
  {
    groupKey: 'records',
    items: [
      {id: 'profiles', icon: User},
      {id: 'addresses', icon: MapPin},
      {id: 'education', icon: GraduationCap},
      {id: 'employment', icon: Briefcase},
    ],
  },
  {
    groupKey: 'automation',
    items: [
      {id: 'autofill', icon: Wand2},
      {id: 'validation', icon: ShieldCheck},
      {id: 'websites', icon: Globe},
      {id: 'history', icon: History},
    ],
  },
  {
    groupKey: 'system',
    items: [
      {id: 'sync', icon: Cloud},
      {id: 'backup', icon: DatabaseBackup},
      {id: 'security', icon: Shield},
      {id: 'settings', icon: Settings},
      {id: 'help', icon: BookOpen},
    ],
  },
];

export const Layout: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {
    page,
    setPage,
    ready,
    isLocked,
    settings,
    t,
    activeProfile,
    connectivityBadgeState,
    syncQueue,
    syncConflicts,
    updateSettings,
    unlockVault,
    lockVaultNow,
    notices,
    dismissNotice,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unlockPass, setUnlockPass] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');
    setUnlockBusy(true);
    const ok = await unlockVault(unlockPass);
    setUnlockBusy(false);
    if (!ok) {
      setUnlockError(
        settings.language === 'bn'
          ? 'পাসফ্রেজ সঠিক নয় অথবা ডিক্রিপশন ব্যর্থ হয়েছে।'
          : 'Incorrect passphrase or vault authentication failed.',
      );
    } else {
      setUnlockPass('');
    }
  };

  const toggleLanguage = () => {
    void updateSettings({language: settings.language === 'en' ? 'bn' : 'en'});
  };

  const cycleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark';
    void updateSettings({theme: next});
  };

  const connectivityConfig = {
    offline: {
      icon: CloudOff,
      text: t.connectivity.offline,
      cls: 'text-amber-600 dark:text-amber-400',
    },
    online: {
      icon: Cloud,
      text: settings.cloudSyncEnabled ? t.connectivity.online : t.connectivity.offline === 'Offline' ? 'Online · Local' : 'অনলাইন · লোকাল',
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    syncing: {
      icon: RefreshCw,
      text: t.connectivity.syncing,
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    sync_required: {
      icon: Activity,
      text: `${t.connectivity.sync_required} (${syncQueue.length})`,
      cls: 'text-amber-600 dark:text-amber-400',
    },
    sync_failed: {
      icon: AlertCircle,
      text: syncConflicts.length > 0 ? `${t.connectivity.sync_failed} (${syncConflicts.length})` : t.connectivity.sync_failed,
      cls: 'text-red-600 dark:text-red-400',
    },
  }[connectivityBadgeState];

  const ConnIcon = connectivityConfig.icon;

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8F7] dark:bg-[#0B0F0E] text-[#0F1714] dark:text-[#F4F7F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg border-2 border-emerald-500 border-t-transparent animate-spin" />
          <p className="text-sm text-[#4F635A] dark:text-[#9CAAA2]">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8F7] dark:bg-[#0B0F0E] p-4">
        <div className="w-full max-w-md rounded-xl border border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17] p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#0F1714] dark:text-[#F4F7F5]">
                {t.brand.name}
              </h1>
              <p className="text-xs text-[#4F635A] dark:text-[#9CAAA2]">
                AES-GCM-256 Local Encrypted Vault
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="vault-unlock-input"
                className="block text-sm font-medium text-[#0F1714] dark:text-[#F4F7F5]"
              >
                {t.security.currentPassphrase}
              </label>
              <input
                id="vault-unlock-input"
                type="password"
                required
                autoFocus
                value={unlockPass}
                onChange={(e) => setUnlockPass(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D7E2DC] dark:border-[#26362F] bg-[#F6F8F7] dark:bg-[#18231E] px-3.5 py-2.5 text-sm text-[#0F1714] dark:text-[#F4F7F5]"
                placeholder="••••••••••••"
              />
            </div>

            {unlockError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {unlockError}
              </p>
            )}

            <button
              type="submit"
              disabled={unlockBusy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {unlockBusy ? 'Deriving Key (PBKDF2)...' : t.security.unlockVault}
            </button>
          </form>

          <p className="mt-5 text-xs leading-relaxed text-[#4F635A] dark:text-[#9CAAA2]">
            {t.security.recoveryWarningBody}
          </p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D7E2DC] dark:border-[#26362F]">
        <button
          type="button"
          onClick={() => {
            setPage('overview');
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 text-left"
        >
          <img
            src="/icon.svg"
            alt=""
            className="h-7 w-7 rounded-md shrink-0"
            width={28}
            height={28}
          />
          <span className="font-display text-base font-bold tracking-tight text-[#0F1714] dark:text-[#F4F7F5] whitespace-nowrap">
            {t.brand.name}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-md p-1.5 text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey}>
            <div className="px-2.5 pb-1.5 text-xs font-medium text-[#4F635A] dark:text-[#9CAAA2]">
              {t.navGroups[group.groupKey]}
            </div>
            <ul className="space-y-0.5">
              {group.items.map(({id, icon: Icon}) => {
                const isActive = page === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPage(id);
                        setMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-600/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] hover:text-[#0F1714] dark:hover:text-[#F4F7F5]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{t.nav[id]}</span>
                      </span>
                      {id === 'sync' && syncConflicts.length > 0 && (
                        <span className="font-mono text-xs text-red-600 dark:text-red-400">
                          {syncConflicts.length}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#D7E2DC] dark:border-[#26362F] px-4 py-3 text-xs text-[#4F635A] dark:text-[#9CAAA2] space-y-1">
        <div className="truncate font-medium text-[#0F1714] dark:text-[#F4F7F5]">
          {activeProfile ? activeProfile.profileName : t.common.noProfileSelected}
        </div>
        <div className="truncate">{t.brand.subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F6F8F7] dark:bg-[#0B0F0E] text-[#0F1714] dark:text-[#F4F7F5]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#D7E2DC] dark:border-[#26362F] bg-white dark:bg-[#121A17]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[82vw] flex flex-col bg-white dark:bg-[#121A17] border-r border-[#D7E2DC] dark:border-[#26362F]">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean Contextual Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#D7E2DC] dark:border-[#26362F] bg-white/95 dark:bg-[#121A17]/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#4F635A] dark:text-[#9CAAA2] whitespace-nowrap">
                {t.brand.name}
              </span>
              <span className="hidden sm:inline text-[#D7E2DC] dark:text-[#26362F]" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-[#0F1714] dark:text-[#F4F7F5] truncate">
                {t.nav[page]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setPage('sync')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors whitespace-nowrap shrink-0 ${connectivityConfig.cls}`}
              title={t.nav.sync}
            >
              <ConnIcon
                className={`h-3.5 w-3.5 ${connectivityBadgeState === 'syncing' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{connectivityConfig.text}</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label="Switch interface language"
              className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] px-2.5 py-1.5 text-xs font-medium text-[#0F1714] dark:text-[#F4F7F5] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors whitespace-nowrap shrink-0"
            >
              {settings.language === 'en' ? 'বাংলা' : 'English'}
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-1.5 text-[#4F635A] dark:text-[#9CAAA2] hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] hover:text-[#0F1714] dark:hover:text-[#F4F7F5] transition-colors shrink-0"
            >
              {settings.theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {settings.encryptionEnabled && (
              <button
                type="button"
                onClick={lockVaultNow}
                aria-label={t.security.lockNow}
                title={t.security.lockNow}
                className="rounded-lg border border-[#D7E2DC] dark:border-[#26362F] p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-[#EEF3F0] dark:hover:bg-[#18231E] transition-colors shrink-0"
              >
                <Lock className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {/* Global Toast Notices */}
        {notices.length > 0 && (
          <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm">
            {notices.map((n) => (
              <div
                key={n.id}
                role="status"
                className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm bg-white dark:bg-[#121A17] ${
                  n.tone === 'error'
                    ? 'border-red-500/50 text-red-700 dark:text-red-300'
                    : n.tone === 'warning'
                      ? 'border-amber-500/50 text-amber-700 dark:text-amber-300'
                      : 'border-emerald-500/50 text-[#0F1714] dark:text-[#F4F7F5]'
                }`}
              >
                <span className="flex items-center gap-2">
                  {n.tone === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                  )}
                  <span>{n.message}</span>
                </span>
                <button
                  type="button"
                  onClick={() => dismissNotice(n.id)}
                  aria-label="Dismiss notification"
                  className="text-[#4F635A] dark:text-[#9CAAA2] hover:text-[#0F1714] dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="border-t border-[#D7E2DC] dark:border-[#26362F] px-6 py-4 text-xs text-[#4F635A] dark:text-[#9CAAA2] flex flex-wrap items-center justify-between gap-2">
          <span>
            {t.brand.name} · {t.common.offlineReady}
          </span>
          <span>{t.brand.credit}</span>
        </footer>
      </div>
    </div>
  );
};
