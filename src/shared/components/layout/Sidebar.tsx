import { NavLink } from 'react-router-dom';
import {
  Users,
  UserPlus,
  CreditCard,
  Stethoscope,
  HeartHandshake,
  Globe,
  ExternalLink,
  BarChart3,
  Settings,
} from 'lucide-react';
import { useSidebar } from '@/shared/context/SidebarContext';

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
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex flex-col h-full justify-between gap-6 select-none">
      {/* Navigation Stage List */}
      <div className="space-y-4">
        <div>
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 transition-opacity duration-300 animate-in fade-in">
              Embudo de Pacientes
            </p>
          )}
          <nav className="space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClickItem}
                title={isCollapsed ? `${item.step}. ${item.label} (${item.description})` : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-xl transition-all duration-300 ease-in-out ${
                    isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md shadow-slate-900/10 dark:shadow-black/20 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all duration-300`}>
                      <div className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                        isActive 
                          ? 'bg-teal-500/20 text-teal-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                      }`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                      </div>
                      
                      {!isCollapsed && (
                        <div className="flex flex-col text-left truncate transition-opacity duration-300 ease-in-out animate-in fade-in">
                          <span className="text-xs font-bold tracking-tight truncate whitespace-nowrap">
                            {item.label}
                          </span>
                          <span className={`text-[10px] leading-tight truncate whitespace-nowrap ${isActive ? 'text-slate-300 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.description}
                          </span>
                        </div>
                      )}
                    </div>

                    {!isCollapsed ? (
                      <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 transition-opacity duration-300 animate-in fade-in ${
                        isActive ? 'bg-slate-800 dark:bg-slate-900 text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700'
                      }`}>
                        {item.step}
                      </span>
                    ) : (
                      isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full animate-in fade-in duration-300" />
                      )
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sección de Simulación Externa / Portal Web */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 transition-opacity duration-300 animate-in fade-in flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Simulación de Captura
            </p>
          )}
          <NavLink
            to="/solicitar-informacion"
            onClick={onClickItem}
            title={isCollapsed ? 'Portal Web Paciente (Landing Pública)' : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-xl transition-all duration-300 ease-in-out ${
                isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md shadow-slate-900/10 dark:shadow-black/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all duration-300`}>
                  <div className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                    isActive 
                      ? 'bg-teal-500/20 text-teal-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                  }`}>
                    <Globe className="h-4 w-4 shrink-0" />
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col text-left truncate transition-opacity duration-300 ease-in-out animate-in fade-in">
                      <span className="text-xs font-bold tracking-tight truncate whitespace-nowrap flex items-center gap-1">
                        Portal Web Paciente
                        <ExternalLink className="h-2.5 w-2.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0" />
                      </span>
                      <span className={`text-[10px] leading-tight truncate whitespace-nowrap ${isActive ? 'text-slate-300 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        Simular Captura / Ads
                      </span>
                    </div>
                  )}
                </div>

                {!isCollapsed ? (
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 transition-opacity duration-300 animate-in fade-in ${
                    isActive ? 'bg-slate-800 dark:bg-slate-900 text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700'
                  }`}>
                    WEB
                  </span>
                ) : (
                  isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full animate-in fade-in duration-300" />
                  )
                )}
              </>
            )}
          </NavLink>
        </div>

        {/* Sección DataMart NexoSalud_Mart */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 transition-opacity duration-300 animate-in fade-in flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" /> DataMart Dimensional
            </p>
          )}
          <NavLink
            to="/reportes"
            onClick={onClickItem}
            title={isCollapsed ? 'Reportes DataMart (NexoSalud_Mart)' : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-xl transition-all duration-300 ease-in-out ${
                isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md shadow-slate-900/10 dark:shadow-black/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all duration-300`}>
                  <div className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                    isActive 
                      ? 'bg-teal-500/20 text-teal-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                  }`}>
                    <BarChart3 className="h-4 w-4 shrink-0" />
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col text-left truncate transition-opacity duration-300 ease-in-out animate-in fade-in">
                      <span className="text-xs font-bold tracking-tight truncate whitespace-nowrap">
                        Reportes DataMart
                      </span>
                      <span className={`text-[10px] leading-tight truncate whitespace-nowrap ${isActive ? 'text-slate-300 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        NexoSalud_Mart (4 Etapas)
                      </span>
                    </div>
                  )}
                </div>

                {!isCollapsed ? (
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 transition-opacity duration-300 animate-in fade-in ${
                    isActive ? 'bg-slate-800 dark:bg-slate-900 text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700'
                  }`}>
                    BI
                  </span>
                ) : (
                  isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full animate-in fade-in duration-300" />
                  )
                )}
              </>
            )}
          </NavLink>
        </div>

        {/* Sección Configuración Clínica */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 transition-opacity duration-300 animate-in fade-in flex items-center gap-1.5">
              <Settings className="h-3 w-3" /> Sistema y Parámetros
            </p>
          )}
          <NavLink
            to="/configuracion"
            onClick={onClickItem}
            title={isCollapsed ? 'Configuración de la Clínica (Parámetros y Catálogos)' : undefined}
            className={({ isActive }) =>
              `group relative flex items-center rounded-xl transition-all duration-300 ease-in-out ${
                isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
              } ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-md shadow-slate-900/10 dark:shadow-black/20 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} overflow-hidden transition-all duration-300`}>
                  <div className={`p-1.5 rounded-lg transition-all duration-200 shrink-0 ${
                    isActive 
                      ? 'bg-teal-500/20 text-teal-300' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                  }`}>
                    <Settings className="h-4 w-4 shrink-0" />
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col text-left truncate transition-opacity duration-300 ease-in-out animate-in fade-in">
                      <span className="text-xs font-bold tracking-tight truncate whitespace-nowrap">
                        Configuración
                      </span>
                      <span className={`text-[10px] leading-tight truncate whitespace-nowrap ${isActive ? 'text-slate-300 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        Clínica, Sedes y Staff
                      </span>
                    </div>
                  )}
                </div>

                {!isCollapsed ? (
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0 transition-opacity duration-300 animate-in fade-in ${
                    isActive ? 'bg-slate-800 dark:bg-slate-900 text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700'
                  }`}>
                    CFG
                  </span>
                ) : (
                  isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full animate-in fade-in duration-300" />
                  )
                )}
              </>
            )}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
