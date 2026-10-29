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
      label: 'Resumen Ejecutivo',
      icon: LayoutDashboard,
      end: true,
      activeClass: 'border-slate-900 text-slate-900 bg-slate-50/90 font-bold',
      inactiveClass: 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
      iconColor: 'text-slate-800',
    },
    {
      to: '/buyer/oportunidades',
      label: 'Oportunidades',
      icon: Users,
      activeClass: 'border-blue-700 text-blue-900 bg-blue-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-blue-800 hover:bg-blue-50/40',
      iconColor: 'text-blue-600',
    },
    {
      to: '/buyer/seguimiento',
      label: 'Bandeja SLA',
      icon: Clock,
      badge: slaBreachCount && slaBreachCount > 0 ? slaBreachCount : undefined,
      badgeColor: 'bg-rose-600 text-white animate-pulse',
      activeClass: 'border-rose-700 text-rose-900 bg-rose-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-rose-800 hover:bg-rose-50/40',
      iconColor: 'text-rose-600',
    },
    {
      to: '/buyer/campanas',
      label: 'Campañas & Costos',
      icon: Megaphone,
      activeClass: 'border-emerald-700 text-emerald-900 bg-emerald-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/40',
      iconColor: 'text-emerald-600',
    },
    {
      to: '/buyer/alertas',
      label: 'Impulse Alerts',
      icon: AlertTriangle,
      badge: alertsCount && alertsCount > 0 ? alertsCount : undefined,
      badgeColor: 'bg-amber-600 text-white',
      activeClass: 'border-amber-600 text-amber-950 bg-amber-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-amber-800 hover:bg-amber-50/40',
      iconColor: 'text-amber-600',
    },
    {
      to: '/buyer/agente-ia',
      label: 'Agente Marketing IA',
      icon: Bot,
      activeClass: 'border-violet-700 text-violet-950 bg-violet-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-violet-800 hover:bg-violet-50/40',
      iconColor: 'text-violet-600',
    },
    {
      to: '/buyer/analitica',
      label: 'Analítica Data Mart',
      icon: BarChart3,
      activeClass: 'border-teal-700 text-teal-950 bg-teal-50/80 font-bold',
      inactiveClass: 'text-slate-600 hover:text-teal-800 hover:bg-teal-50/40',
      iconColor: 'text-teal-600',
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 pt-2 pb-0 gap-3">
        {/* Pestañas de navegación con colores formales distintivos */}
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar" aria-label="Fase Buyer">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 px-3.5 py-2.5 text-xs rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? `${tab.activeClass} shadow-xs`
                      : `border-transparent ${tab.inactiveClass}`
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? tab.iconColor : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Botón de acción rápida: Nueva Captación Manual */}
        <div className="pb-2 shrink-0">
          <NavLink
            to="/buyer/nuevo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Registrar Contacto</span>
          </NavLink>
        </div>
      </div>
    </div>
  );
};
