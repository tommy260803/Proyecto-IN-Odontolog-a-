import React from 'react';
import { cn } from '@/shared/utils/index';

interface LoadingStateProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Nexo Salud Minimal Dental Loader
 * Diseño limpio y moderno: Diente anatómico + Anillo orbital rotatorio + 3 puntos de carga animados.
 * Totalmente centrado vertical y horizontalmente.
 */
export function DentalToothIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-24 h-24' : 'w-18 h-18';
  const svgSize = size === 'sm' ? 28 : size === 'lg' ? 48 : 36;
  const ringSize = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-28 h-28' : 'w-22 h-22';

  return (
    <div className={cn("relative flex items-center justify-center select-none", dim)}>
      {/* 1. Aura de Pulso Clínico Radiante */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-500/20 via-cyan-400/15 to-emerald-400/10 blur-md animate-dental-pulse-aura pointer-events-none" />

      {/* 2. Anillo de Escaneo Orbital con Giros Suaves */}
      <svg 
        className={cn(
          "absolute text-teal-500/60 dark:text-teal-400/50 animate-spin pointer-events-none", 
          ringSize
        )}
        style={{ animationDuration: '3.5s' }}
        viewBox="0 0 100 100" 
        fill="none"
      >
        <circle 
          cx="50" 
          cy="50" 
          r="46" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeDasharray="10 8 4 8"
          strokeLinecap="round"
        />
        <circle 
          cx="50" 
          cy="4" 
          r="4" 
          className="fill-teal-500 text-teal-500 shadow-sm"
        />
      </svg>

      {/* 3. Diente Odontológico Flotante (Sin recuadro) */}
      <div className="relative flex items-center justify-center animate-dental-float">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-md"
        >
          <defs>
            <linearGradient id="dentalToothGrad" x1="8" y1="6" x2="40" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0d9488" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="dentalEnamelHighlight" x1="14" y1="8" x2="26" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Silueta Anatómica Odontológica */}
          <path
            d="M24 7 C17 7 10 10.5 10 18 C10 24.5 13.5 31.5 17 40.5 C18.2 43.5 20.8 43.5 21.8 39 C22.8 33.5 23.5 28.5 24 25 C24.5 28.5 25.2 33.5 26.2 39 C27.2 43.5 29.8 43.5 31 40.5 C34.5 31.5 38 24.5 38 18 C38 10.5 31 7 24 7 Z"
            fill="url(#dentalToothGrad)"
            stroke="#0f766e"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Reflejo de Esmalte en la Corona Superior */}
          <path
            d="M15 14 C15 14 18 10 24 10 C27 10 29 11 29 11 C26 12 21 14 18 19 C16 22 15 26 15 26 C15 26 14 20 15 14 Z"
            fill="url(#dentalEnamelHighlight)"
          />

          {/* Línea de Cíngulo Central */}
          <path
            d="M21 17 C23 18.5 25 18.5 27 17"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0.75"
          />
        </svg>

        {/* 4. Destello Radiante en la Cúspide (Sparkle Star) */}
        <div className="absolute -top-1 -right-1 z-20 text-teal-400 dark:text-teal-200 animate-dental-gleam pointer-events-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
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
      "w-full h-full min-h-[160px] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300",
      className
    )}>
      {/* Ícono Odontológico Animado Nexo Salud */}
      <DentalToothIcon size={size} />

      {/* 3 Puntos de Carga Animados (Bouncing Dots) */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
