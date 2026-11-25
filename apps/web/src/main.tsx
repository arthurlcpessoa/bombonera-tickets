import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
// Fonte embutida no build (não depende do Google Fonts). "Variable" = um só arquivo com todos os pesos.
import '@fontsource-variable/plus-jakarta-sans';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
