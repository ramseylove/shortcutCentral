import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadStoredConfigs } from './store/config';
import './styles.css';

// A stored config changes pack contents, so it is put into effect before anything renders.
await loadStoredConfigs().catch((error) => console.error('Could not load the stored config', error));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
