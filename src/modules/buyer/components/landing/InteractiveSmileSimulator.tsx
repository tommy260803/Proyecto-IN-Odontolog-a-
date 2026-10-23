import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  MoveHorizontal,
  CheckCircle2,
  Clock,
  HeartPulse,
} from 'lucide-react';
import type { ReasonChipOption } from './landingData';

interface InteractiveSmileSimulatorProps {
  onSelectTreatment: (reasonId: ReasonChipOption['id'], treatmentTitle?: string) => void;
}

interface SimulationCase {
  id: ReasonChipOption['id'];
  name: string;
  badge: string;
  icon: typeof Sparkles;
  headline: string;
  description: string;
  timeframe: string;
  painRating: string;
  satisfaction: string;
  beforeLabel: string;
  afterLabel: string;
  features: string[];
  // Colores visuales del canvas
  beforeAccent: string;
  afterAccent: string;
}

const SIMULATION_CASES: SimulationCase[] = [
  {
    id: 'ortodoncia',
    name: 'Alineadores Invisibles',
    badge: 'Ortodoncia Digital 3D',
    icon: Sparkles,
    headline: 'Alineación milimétrica sin brackets metálicos',
    description:
      'Planificación guiada por computadora: corrige apiñamientos y mordida con férulas transparentes y removibles.',
    timeframe: '6 a 12 meses',
    painRating: '0% dolor reportado',
    satisfaction: '99.2%',
    beforeLabel: 'Antes: Apiñamiento y desalineación',
    afterLabel: 'Después: Arco simétrico y mordida perfecta',
    features: ['Removible para comer', 'Sin alambres ni cortes', 'Simulación 3D en pantalla'],
    beforeAccent: '#94A3B8',
    afterAccent: '#0F766E',
  },
  {
    id: 'estetica',
    name: 'Diseño de Sonrisa & Carillas',
    badge: 'Alta Estética',
    icon: Zap,
    headline: 'Armonía dental y aclaramiento ultra natural',
    description:
      'Carillas cerámicas ultradelgadas y blanqueamiento LED que respetan el esmalte original con máxima luminosidad.',
    timeframe: '1 a 2 sesiones',
    painRating: 'Procedimiento indoloro',
    satisfaction: '99.8%',
    beforeLabel: 'Antes: Desgaste y manchas oscuras',
    afterLabel: 'Después: Esmalte brillante y proporción áurea',
    features: ['Grosor de 0.3mm sin tallado agresivo', 'Tono personalizado', 'Brillo permanente'],
    beforeAccent: '#CBD5E1',
    afterAccent: '#0D9488',
  },
  {
    id: 'implante',
    name: 'Implantes Guiados 3D',
    badge: 'Rehabilitación Integral',
    icon: ShieldCheck,
    headline: 'Recupera la fuerza masticatoria y estética total',
    description:
      'Fijación en titanio osteointegrado planificada con tomografía CBCT para una colocación exacta sin suturas invasivas.',
    timeframe: 'Mismo día provisional',
    painRating: 'Anestesia suave computarizada',
    satisfaction: '98.9%',
    beforeLabel: 'Antes: Pérdida dental y colapso óseo',
    afterLabel: 'Después: Diente fijo definitivo con raíz biónica',
    features: ['Cirugía guiada por tomografía', 'Corona de circonio', 'Garantía clínica de por vida'],
    beforeAccent: '#94A3B8',
    afterAccent: '#059669',
  },
];

export function InteractiveSmileSimulator({ onSelectTreatment }: InteractiveSmileSimulatorProps) {
  const [activeCaseId, setActiveCaseId] = useState<ReasonChipOption['id']>('ortodoncia');
  const [sliderPosition, setSliderPosition] = useState<number>(52); // Porcentaje (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCase =
    SIMULATION_CASES.find((c) => c.id === activeCaseId) || SIMULATION_CASES[0];

  // Cálculo de arrastre táctil / mouse
  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(x, rect.width));
    const percentage = (clampedX / rect.width) * 100;
    setSliderPosition(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleDirectClick = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.06)]">
      {/* Cabecera del Simulador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold text-slate-900 tracking-tight">
              Simulador Visual de Sonrisa 3D
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[#065F46] border border-emerald-200/60">
              Interactivo
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Arrastra el control deslizante para comparar el antes y después de cada tratamiento.
          </p>
        </div>

        {/* Selector de Casos */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto">
          {SIMULATION_CASES.map((item) => {
            const isSelected = item.id === activeCaseId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveCaseId(item.id);
                  setSliderPosition(52);
                }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {item.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA INTERACTIVA DE COMPARACIÓN (SLIDER ANTES / DESPUÉS) */}
      <div className="mt-3.5">
        <div
          ref={containerRef}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onClick={handleDirectClick}
          className="relative h-48 sm:h-56 w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-950 cursor-ew-resize group"
        >
          {/* Capa de FONDO (DESPUÉS: Resultado Ideal) */}
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-950/70 to-slate-900 px-6">
            {/* Visualización Esquemática Vectorial de Sonrisa Perfecta */}
            <div className="w-full max-w-sm flex flex-col items-center justify-center text-center">
              {/* Sonrisa alineada con brillo */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {[1, 2, 3, 4, 5, 6].map((tooth) => (
                    <motion.div
                      key={tooth}
                      animate={{
                        y: [0, -2, 0],
                        opacity: [0.95, 1, 0.95],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: tooth * 0.15,
                        ease: 'easeInOut',
                      }}
                      className="h-14 sm:h-16 w-6 sm:w-7.5 rounded-t-lg rounded-b-2xl bg-gradient-to-b from-white via-slate-50 to-teal-50 border border-teal-200/80 shadow-[0_0_12px_rgba(20,184,166,0.3)] flex flex-col items-center justify-end pb-1"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-400/40" />
                    </motion.div>
                  ))}
                </div>
                {/* Destello de simulación 3D */}
                <div className="absolute -top-2 right-4 flex items-center gap-1 rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-mono text-teal-300 border border-teal-400/30">
                  <Sparkles className="h-3 w-3 text-teal-300 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Proporción Áurea</span>
                </div>
              </div>

              <span className="text-xs font-semibold text-teal-200 tracking-wide uppercase">
                {activeCase.afterLabel}
              </span>
            </div>
          </div>

          {/* Capa de RECORTE (ANTES: Estado Previo sin Tratar) */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-r-2 border-white/90 shadow-2xl"
            style={{ width: `${sliderPosition}%` }}
          >
            <div
              className="absolute inset-y-0 left-0 flex items-center justify-center px-6"
              style={{ width: containerRef.current ? containerRef.current.clientWidth : '100%' }}
            >
              <div className="w-full max-w-sm flex flex-col items-center justify-center text-center">
                {/* Dientes desalineados / apiñados esquemáticos */}
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    {[
                      { h: 'h-11 sm:h-13', rotate: '-rotate-6', y: 'translate-y-1' },
                      { h: 'h-14 sm:h-16', rotate: 'rotate-4', y: '-translate-y-0.5' },
                      { h: 'h-13 sm:h-15', rotate: '-rotate-2', y: 'translate-y-2' },
                      { h: 'h-15 sm:h-17', rotate: 'rotate-8', y: '-translate-y-1' },
                      { h: 'h-12 sm:h-14', rotate: '-rotate-4', y: 'translate-y-0.5' },
                      { h: 'h-10 sm:h-12', rotate: 'rotate-3', y: 'translate-y-2' },
                    ].map((tooth, idx) => (
                      <div
                        key={idx}
                        className={`${tooth.h} ${tooth.rotate} ${tooth.y} w-6 sm:w-7 rounded-t-md rounded-b-xl bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border border-slate-400/60 shadow-inner flex flex-col items-center justify-end pb-1`}
                      >
                        <div className="h-1 w-2 rounded-full bg-slate-500/40" />
                      </div>
                    ))}
                  </div>

                  <div className="absolute -top-2 left-4 flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-slate-600/50">
                    <span>Diagnóstico Inicial</span>
                  </div>
                </div>

                <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                  {activeCase.beforeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Manija táctil central del divisor */}
          <div
            className="absolute top-0 bottom-0 -ml-3.5 flex items-center justify-center pointer-events-none transition-transform duration-75"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.3)] ring-2 ring-teal-500 transition-transform group-hover:scale-110">
              <MoveHorizontal className="h-4 w-4 text-teal-700" />
            </div>
          </div>

          {/* Badges de orientación en las esquinas */}
          <div className="pointer-events-none absolute bottom-2.5 left-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-xs">
            Antes ({Math.round(sliderPosition)}%)
          </div>
          <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-md bg-teal-900/80 px-2 py-0.5 text-[10px] font-semibold text-teal-100 backdrop-blur-xs">
            Resultado Simulado ({100 - Math.round(sliderPosition)}%)
          </div>
        </div>
      </div>

      {/* METRICAS CLÍNICAS Y CALL TO ACTION */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCase.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mt-3.5 space-y-3"
        >
          {/* 3 Métricas Destacadas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-center">
              <span className="flex items-center justify-center gap-1 text-[10.5px] text-slate-500 font-medium">
                <Clock className="h-3 w-3 text-teal-600" />
                Duración
              </span>
              <p className="mt-0.5 font-mono text-xs font-bold text-slate-800">
                {activeCase.timeframe}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-center">
              <span className="flex items-center justify-center gap-1 text-[10.5px] text-slate-500 font-medium">
                <HeartPulse className="h-3 w-3 text-teal-600" />
                Confort
              </span>
              <p className="mt-0.5 font-mono text-xs font-bold text-teal-700">
                {activeCase.painRating}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 text-center">
              <span className="flex items-center justify-center gap-1 text-[10.5px] text-slate-500 font-medium">
                <CheckCircle2 className="h-3 w-3 text-teal-600" />
                Satisfacción
              </span>
              <p className="mt-0.5 font-mono text-xs font-bold text-slate-800">
                {activeCase.satisfaction}
              </p>
            </div>
          </div>

          {/* Características Clave & Botón de Evaluación Directa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {activeCase.features.map((feat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600"
                >
                  <CheckCircle2 className="h-3 w-3 text-teal-600" />
                  <span>{feat}</span>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onSelectTreatment(activeCase.id, activeCase.headline)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.98] cursor-pointer"
            >
              <span>Evaluar mi caso con {activeCase.name.split(' ')[0]}</span>
              <ArrowRight className="h-3.5 w-3.5 text-teal-400" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
