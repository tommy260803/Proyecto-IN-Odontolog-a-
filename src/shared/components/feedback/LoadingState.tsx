import React from 'react';
import { cn } from '@/shared/utils/index';

interface LoadingStateProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Nexo Salud Dental Loader
 * Diente blanco puro dentro de un círculo sólido celeste medio oscuro (sin borde),
 * acompañado de 3 puntos animados con salto dinámico arriba-abajo.
 * Perfectamente centrado vertical y horizontalmente.
 */
export function DentalToothIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const circleSize = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-20 h-20' : 'w-16 h-16';
  const svgSize = size === 'sm' ? 24 : size === 'lg' ? 42 : 32;

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* 1. Círculo sólido sin borde de color celeste medio oscuro */}
      <div className={cn(
        "rounded-full bg-[#0284c7] dark:bg-[#0369a1] shadow-lg shadow-sky-500/20 flex items-center justify-center transition-transform",
        circleSize
      )}>
        {/* 2. Diente Blanco Puro Flotante */}
        <div className="relative flex items-center justify-center animate-dental-float">
          <svg
            width={svgSize}
            height={svgSize}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 drop-shadow-xs"
          >
            {/* Silueta Anatómica Odontológica Blanca Pura */}
            <path
              d="M24 7 C17 7 10 10.5 10 18 C10 24.5 13.5 31.5 17 40.5 C18.2 43.5 20.8 43.5 21.8 39 C22.8 33.5 23.5 28.5 24 25 C24.5 28.5 25.2 33.5 26.2 39 C27.2 43.5 29.8 43.5 31 40.5 C34.5 31.5 38 24.5 38 18 C38 10.5 31 7 24 7 Z"
              fill="#ffffff"
              stroke="#ffffff"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />

            {/* Línea de Cíngulo Anatómico */}
            <path
              d="M21 17 C23 18.5 25 18.5 27 17"
              stroke="#e0f2fe"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
          </svg>

          {/* 3. Destello Radiante en la Cúspide */}
          <div className="absolute -top-1 -right-0.5 z-20 text-white animate-dental-gleam pointer-events-none drop-shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
            </svg>
          </div>
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
      {/* Diente Blanco en Círculo Celeste */}
      <DentalToothIcon size={size} />

      {/* 3 Puntos Animados con Salto Dinámico Arriba-Abajo */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        <span 
          className="w-2.5 h-2.5 rounded-full bg-[#0284c7] dark:bg-sky-400 animate-dental-dot-jump" 
          style={{ animationDelay: '0ms' }} 
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-[#0284c7] dark:bg-sky-400 animate-dental-dot-jump" 
          style={{ animationDelay: '180ms' }} 
        />
        <span 
          className="w-2.5 h-2.5 rounded-full bg-[#0284c7] dark:bg-sky-400 animate-dental-dot-jump" 
          style={{ animationDelay: '360ms' }} 
        />
      </div>
    </div>
  );
}
