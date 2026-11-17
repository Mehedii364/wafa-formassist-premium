import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register offline-first PWA service worker gracefully
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisterError() {
        // Non-fatal in sandboxed iframe environments
      },
    });
  } catch {
    // Offline fallback continues via IndexedDB
  }
}

createRoot(document.getElementById('root')!).render(<App />);
