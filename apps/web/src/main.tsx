import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
// Fonte embutida no build (não depende do Google Fonts). "Variable" = um só arquivo com todos os pesos.
import '@fontsource-variable/plus-jakarta-sans';
import '@/index.css';
import { queryClient } from '@/lib/queries';
import { syncSeatViewWithUrl } from '@/store/seatViewUrl';

// ?assento=... abre direto na visão daquela cadeira (antes do primeiro render).
syncSeatViewWithUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
