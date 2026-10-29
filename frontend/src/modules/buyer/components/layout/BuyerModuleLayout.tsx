import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BuyerNavTabs } from '../navigation/BuyerNavTabs';
import { buyerService } from '../../services/buyer.service';

interface BuyerModuleLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const SECTION_THEMES: Record<string, { badge: string; colorClass: string; borderAccent: string }> = {
  '/buyer': {
    badge: 'Resumen Ejecutivo',
    colorClass: 'bg-slate-100 text-slate-800 border-slate-200',
    borderAccent: 'bg-slate-900',
  },
  '/buyer/oportunidades': {
    badge: 'Pipeline de Oportunidades',
    colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
    borderAccent: 'bg-blue-600',
  },
  '/buyer/seguimiento': {
    badge: 'Control SLA & Primera Respuesta',
    colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
    borderAccent: 'bg-rose-600',
  },
  '/buyer/campanas': {
    badge: 'Atribución & Gastos Publicitarios',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderAccent: 'bg-emerald-600',
  },
  '/buyer/alertas': {
    badge: 'Resolución de Impulse Alerts',
    colorClass: 'bg-amber-50 text-amber-900 border-amber-200',
    borderAccent: 'bg-amber-500',
  },
  '/buyer/agente-ia': {
    badge: 'Supervisión de Agente IA',
    colorClass: 'bg-violet-50 text-violet-900 border-violet-200',
    borderAccent: 'bg-violet-600',
  },
  '/buyer/analitica': {
    badge: 'Data Mart & BI Oficial',
    colorClass: 'bg-teal-50 text-teal-900 border-teal-200',
    borderAccent: 'bg-teal-600',
  },
};

export const BuyerModuleLayout: React.FC<BuyerModuleLayoutProps> = ({
  children,
  title = 'Fase 1: BUYER — Captación & Orientación Comercial',
  subtitle = 'Gestión de primer contacto, triaje de intención comercial, SLA de respuesta y atribución de campañas.',
}) => {
  const location = useLocation();
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [slaBreachCount, setSlaBreachCount] = useState<number>(0);

  const currentTheme = SECTION_THEMES[location.pathname] || {
    badge: 'Fase BUYER',
    colorClass: 'bg-slate-100 text-slate-800 border-slate-200',
    borderAccent: 'bg-slate-800',
  };

  useEffect(() => {
    // Carga de badges en vivo
    buyerService
      .getAlerts({ estado: 'ACTIVA' })
      .then((res) => setAlertsCount(res.count || (res.data ? res.data.length : 0)))
      .catch(() => {});

    buyerService
      .getFollowUps()
      .then((res) => {
        const breached = (res.data || []).filter((t: any) => t.isSlaBreached).length;
        setSlaBreachCount(breached);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-14 font-sans text-slate-900">
      {/* Línea de acento cromático formal según el módulo */}
      <div className={`h-1.5 w-full ${currentTheme.borderAccent}`} />

      {/* Top Header */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8 pt-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                IMPULSE · Fase 1
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${currentTheme.colorClass}`}>
                {currentTheme.badge}
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">NexoSalud Odontología</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              {title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Navegación interna horizontal con pestañas cromáticas */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto">
          <BuyerNavTabs alertsCount={alertsCount} slaBreachCount={slaBreachCount} />
        </div>
      </div>

      {/* Contenido principal de la vista */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        {children}
      </main>
    </div>
  );
};
