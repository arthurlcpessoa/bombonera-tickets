import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
// Fonte embutida no build (não depende do Google Fonts). "Variable" = um só arquivo com todos os pesos.
import '@fontsource-variable/plus-jakarta-sans';
import '@/index.css';
import { createQueryClient } from '@/lib/queries';
import { syncSeatViewWithUrl } from '@/store/seatViewUrl';

// ?assento=... abre direto na visão daquela cadeira (antes do primeiro render).
syncSeatViewWithUrl();

// O "caderno" (cache) do TanStack Query: um só para o site inteiro.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
