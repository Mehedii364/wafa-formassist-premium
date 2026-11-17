import React from 'react';
import {Layout} from './components/Layout';
import {AppProvider, useApp} from './context/AppContext';
import {AddressesPage} from './pages/AddressesPage';
import {AutofillCenterPage} from './pages/AutofillCenterPage';
import {BackupRestorePage} from './pages/BackupRestorePage';
import {EducationPage} from './pages/EducationPage';
import {EmploymentPage} from './pages/EmploymentPage';
import {HelpDocsPage} from './pages/HelpDocsPage';
import {HistoryPage} from './pages/HistoryPage';
import {OverviewPage} from './pages/OverviewPage';
import {ProfilesPage} from './pages/ProfilesPage';
import {SecurityCenterPage} from './pages/SecurityCenterPage';
import {SettingsPage} from './pages/SettingsPage';
import {SyncCenterPage} from './pages/SyncCenterPage';
import {ValidationCenterPage} from './pages/ValidationCenterPage';
import {WebsitesPage} from './pages/WebsitesPage';

const PageRouter: React.FC = () => {
  const {page} = useApp();

  switch (page) {
    case 'overview':
      return <OverviewPage />;
    case 'profiles':
      return <ProfilesPage />;
    case 'addresses':
      return <AddressesPage />;
    case 'education':
      return <EducationPage />;
    case 'employment':
      return <EmploymentPage />;
    case 'autofill':
      return <AutofillCenterPage />;
    case 'websites':
      return <WebsitesPage />;
    case 'validation':
      return <ValidationCenterPage />;
    case 'history':
      return <HistoryPage />;
    case 'sync':
      return <SyncCenterPage />;
    case 'backup':
      return <BackupRestorePage />;
    case 'security':
      return <SecurityCenterPage />;
    case 'settings':
      return <SettingsPage />;
    case 'help':
      return <HelpDocsPage />;
  }
};

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <PageRouter />
      </Layout>
    </AppProvider>
  );
}
