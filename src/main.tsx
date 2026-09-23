import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import './index.css';
import { App } from './App';
import { initInstallPromptCapture } from './pwa/installPrompt';
import { useSettingsStore } from './store/settingsStore';

initInstallPromptCapture();
void useSettingsStore.getState().load();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
