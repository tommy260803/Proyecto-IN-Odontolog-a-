import React, { useState, useEffect } from 'react';
import { BuyerNavTabs } from '../navigation/BuyerNavTabs';
import { buyerService } from '../../services/buyer.service';

interface BuyerModuleLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const BuyerModuleLayout: React.FC<BuyerModuleLayoutProps> = ({
  children,
  title = 'Fase 1: BUYER — Captación & Orientación Comercial',
  subtitle = 'Gestión de primer contacto, triaje de intención comercial, SLA de respuesta y atribución de campañas.',
}) => {
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [slaBreachCount, setSlaBreachCount] = useState<number>(0);

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
    <div className="min-h-screen bg-slate-50/50 pb-12 font-sans text-slate-900">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-100">
                Metodología IMPULSE · Fase 1
              </span>
              <span className="text-xs text-slate-400 font-mono">NexoSalud Odontología</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 mt-1">
              {title}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Navegación interna horizontal */}
      <BuyerNavTabs alertsCount={alertsCount} slaBreachCount={slaBreachCount} />

      {/* Contenido de la vista */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {children}
      </main>
    </div>
  );
};
