import { NavLink } from 'react-router-dom';
import {
  Users,
  UserPlus,
  CreditCard,
  Stethoscope,
  HeartHandshake,
  Building2,
  Sparkles
} from 'lucide-react';

const navItems = [
  { 
    to: '/buyer', 
    label: 'BUYER', 
    step: '01',
    description: 'Atracción y Captura',
    icon: Users 
  },
  { 
    to: '/lead', 
    label: 'LEAD', 
    step: '02',
    description: 'Mesa de Negociación',
    icon: UserPlus 
  },
  { 
    to: '/payer', 
    label: 'PAYER', 
    step: '03',
    description: 'Cobros y Validación',
    icon: CreditCard 
  },
  { 
    to: '/customer', 
    label: 'CUSTOMER', 
    step: '04',
    description: 'Atención Odontológica',
    icon: Stethoscope 
  },
  { 
    to: '/turned', 
    label: 'TURNED', 
    step: '05',
    description: 'Fidelización y Retorno',
    icon: HeartHandshake 
  },
];

export function Sidebar({ onClickItem }: { onClickItem?: () => void }) {
  return (
    <div className="flex flex-col h-full justify-between gap-6">
      {/* Navigation Stage List */}
      <div className="space-y-4">
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Embudo de Pacientes
          </p>
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClickItem}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-all duration-200 ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md shadow-slate-900/10 dark:shadow-black/20 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-teal-500/20 text-teal-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                      }`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-bold tracking-tight">
                          {item.label}
                        </span>
                        <span className={`text-[10px] leading-tight ${isActive ? 'text-slate-300 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-slate-800 dark:bg-slate-900 text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700'
                    }`}>
                      {item.step}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Clinical Node Status Widget */}
      <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-slate-800">
        <div className="p-3.5 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900 dark:to-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Building2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Sede San Isidro</span>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>SQL Server:</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">En línea</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Modo BI:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> 8° Ciclo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
