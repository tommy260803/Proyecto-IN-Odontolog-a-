import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import './app/styles/globals.css';
import { initializeMockData } from './infrastructure/seed';

// Inicializar datos simulados de forma asíncrona pero no bloqueante para el renderizado inicial rápido
initializeMockData().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
