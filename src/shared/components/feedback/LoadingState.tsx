import React from 'react';
import { cn } from '@/shared/utils/index';

interface LoadingStateProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Nexo Salud Pure White Minimal Dental Loader
 * Diseño minimalista: Diente odontológico blanco puro flotante + 3 puntos animados.
 * Perfectamente centrado horizontal y verticalmente en el contenido del Sidebar y modales.
 */
export function DentalToothIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const svgSize = size === 'sm' ? 32 : size === 'lg' ? 56 : 44;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* 1. Halo Suave de Pulso Clínico */}
      <div className="absolute inset-0 rounded-full bg-slate-200/50 dark:bg-white/10 blur-md animate-dental-pulse-aura pointer-events-none" />

      {/* 2. Diente Odontológico Blanco Puro Flotante */}
      <div className="relative flex items-center justify-center animate-dental-float">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.14)] dark:drop-shadow-[0_4px_16px_rgba(255,255,255,0.22)]"
        >
          {/* Silueta Anatómica Odontológica Blanca Pura */}
          <path
            d="M24 7 C17 7 10 10.5 10 18 C10 24.5 13.5 31.5 17 40.5 C18.2 43.5 20.8 43.5 21.8 39 C22.8 33.5 23.5 28.5 24 25 C24.5 28.5 25.2 33.5 26.2 39 C27.2 43.5 29.8 43.5 31 40.5 C34.5 31.5 38 24.5 38 18 C38 10.5 31 7 24 7 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="dark:stroke-slate-600"
          />

          {/* Reflejo de Brillo Superior Suave */}
          <path
            d="M15 14 C15 14 18 10 24 10 C27 10 29 11 29 11 C26 12 21 14 18 19 C16 22 15 26 15 26 C15 26 14 20 15 14 Z"
            fill="#f8fafc"
            fillOpacity="0.8"
          />

          {/* Línea de Cíngulo Central Sutil */}
          <path
            d="M21 17 C23 18.5 25 18.5 27 17"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0.5"
            className="dark:stroke-slate-400"
          />
        </svg>

        {/* 3. Destello Radiante en la Cúspide */}
        <div className="absolute -top-1 -right-1 z-20 text-white dark:text-slate-100 animate-dental-gleam pointer-events-none drop-shadow-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  size = 'md',
  className,
}: LoadingStateProps) {
  return (
    <div className={cn(
      "w-full flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 my-auto text-center select-none animate-in fade-in duration-300",
      className
    )}>
      {/* Diente Odontológico Blanco Puro Animado */}
      <DentalToothIcon size={size} />

      {/* 3 Puntos de Carga Animados (Bouncing Dots) */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
