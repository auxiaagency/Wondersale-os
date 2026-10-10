import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Handle dynamic import / chunk load failures in production gracefully.
// When a new version is deployed to production, old chunk hashes disappear.
// Vite dispatches 'vite:preloadError' whenever an asset import fails.
window.addEventListener('vite:preloadError', (event) => {
  const reloadKey = 'vite_preload_reloaded';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, 'true');
    window.location.reload();
  }
});

// Clear preload reload flag once the app has successfully loaded/run
window.addEventListener('load', () => {
  setTimeout(() => {
    sessionStorage.removeItem('vite_preload_reloaded');
  }, 3000);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

