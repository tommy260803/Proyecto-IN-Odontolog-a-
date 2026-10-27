import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  Megaphone,
  AlertTriangle,
  Bot,
  BarChart3,
  PlusCircle,
} from 'lucide-react';

interface BuyerNavTabsProps {
  alertsCount?: number;
  slaBreachCount?: number;
}

export const BuyerNavTabs: React.FC<BuyerNavTabsProps> = ({ alertsCount, slaBreachCount }) => {
  const tabs = [
    {
      to: '/buyer',
      label: 'Resumen',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/buyer/oportunidades',
      label: 'Oportunidades',
      icon: Users,
    },
    {
      to: '/buyer/seguimiento',
      label: 'Bandeja SLA',
      icon: Clock,
      badge: slaBreachCount && slaBreachCount > 0 ? slaBreachCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      to: '/buyer/campanas',
      label: 'Campañas & Costos',
      icon: Megaphone,
    },
    {
      to: '/buyer/alertas',
      label: 'Impulse Alerts',
      icon: AlertTriangle,
      badge: alertsCount && alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      to: '/buyer/agente-ia',
      label: 'Agente Marketing IA',
      icon: Bot,
    },
    {
      to: '/buyer/analitica',
      label: 'Analítica & KPIs',
      icon: BarChart3,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 pt-3 pb-0 gap-3">
        {/* Pestañas de navegación */}
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar" aria-label="Fase Buyer">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Botón de acción rápida: Nueva Captación Manual */}
        <div className="pb-2 sm:pb-1 shrink-0">
          <NavLink
            to="/buyer/nuevo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Registrar Contacto</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
};
