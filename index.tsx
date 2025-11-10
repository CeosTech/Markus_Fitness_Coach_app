
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import { CMSProvider } from './contexts/CMSContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <CMSProvider>
        <App />
      </CMSProvider>
    </LanguageProvider>
  </React.StrictMode>
);
