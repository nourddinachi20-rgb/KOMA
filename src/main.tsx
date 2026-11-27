import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installAndroidBridgeIfNeeded } from './utils/androidBridge';
import './index.css';

installAndroidBridgeIfNeeded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
