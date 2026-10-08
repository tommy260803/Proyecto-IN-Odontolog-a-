import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/shared/utils/index';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'default' | 'minimal';
}

/**
 * Nexo Salud Animated Dental Tooth Loader
 * Ícono temático odontológico con halo de pulso clínico, destello de esmalte y anillo rotatorio
 */
export function DentalToothIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const svgSize = size === 'sm' ? 24 : size === 'lg' ? 44 : 32;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* 1. Aura de Pulso Clínico Radiante */}
      <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-teal-500/25 via-cyan-400/20 to-emerald-400/15 blur-lg animate-dental-pulse-aura pointer-events-none" />

      {/* 2. Anillo de Escaneo Orbital con Giros Suaves */}
      <svg 
        className={cn(
          "absolute text-teal-400/50 dark:text-teal-500/40 animate-spin pointer-events-none", 
          size === 'sm' ? 'w-14 h-14' : size === 'lg' ? 'w-28 h-28' : 'w-20 h-20'
        )}
        style={{ animationDuration: '4s' }}
        viewBox="0 0 100 100" 
        fill="none"
      >
        <circle 
          cx="50" 
          cy="50" 
          r="46" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeDasharray="10 8 4 8"
          strokeLinecap="round"
        />
        <circle 
          cx="50" 
          cy="4" 
          r="3" 
          className="fill-teal-500 text-teal-500 shadow-sm"
        />
      </svg>

      {/* 3. Contenedor Principal del Diente (Bento Glass Badge) */}
      <div className={cn(
        "relative rounded-2xl bg-gradient-to-b from-white via-teal-50/60 to-teal-100/40 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 border border-teal-200/90 dark:border-teal-700/60 shadow-md flex items-center justify-center overflow-hidden animate-dental-float",
        dim
      )}>
        {/* Barrido de Brillo/Esmalte Limpio */}
        <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/70 dark:via-teal-300/20 to-transparent skew-x-12 animate-dental-shine-sweep pointer-events-none" />

        {/* SVG Anatómico del Diente Estilizado Odontológico */}
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-xs"
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

          {/* Reflejo de Esmalte en la Corona Superior Izquierda */}
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
        <div className="absolute top-1.5 right-1.5 z-20 text-teal-400 dark:text-teal-200 animate-dental-gleam pointer-events-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  message = 'Cargando registros...',
  subMessage = 'Nexo Salud · Odontología Especializada',
  size = 'md',
  className,
  variant = 'default',
}: LoadingStateProps) {
  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center justify-center gap-3 p-4", className)}>
        <DentalToothIcon size="sm" />
        <div className="text-left">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{message}</p>
          {subMessage && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{subMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 sm:p-12 text-center select-none animate-in fade-in duration-300",
      className
    )}>
      {/* Ícono Odontológico Animado Nexo Salud */}
      <div className="mb-4">
        <DentalToothIcon size={size} />
      </div>

      {/* Badge de Estado Activo */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/70 border border-teal-200/90 dark:border-teal-800/80 text-teal-800 dark:text-teal-300 text-[11px] font-bold shadow-2xs mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-600 dark:bg-teal-400" />
        </span>
        <span>{message}</span>
      </div>

      {/* Subtítulo Clínico */}
      {subMessage && (
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
          <span>{subMessage}</span>
        </p>
      )}

      {/* Indicador de Micro-Puntos de Procesamiento */}
      <div className="flex items-center justify-center gap-1 mt-3">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
