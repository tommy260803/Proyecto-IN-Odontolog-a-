import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/layout/Header';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { useSidebar } from '@/shared/context/SidebarContext';
import { useTheme } from '@/shared/context/ThemeContext';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function AppLayout() {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { theme } = useTheme();

  const logoSrc = theme === 'dark' ? '/Logo_NexoSalus_Oscuro.png' : '/Logo_NexoSalud.png';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar Desktop Fijo / Expandible */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 h-screen border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-[width] duration-300 ease-in-out z-30 select-none ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Header & Fixed Toggle */}
          <div className={`flex h-20 items-center border-b border-slate-200/80 dark:border-slate-800 shrink-0 transition-all duration-300 ease-in-out ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}>
            {!isCollapsed ? (
              <div className="flex items-center justify-between w-full animate-in fade-in duration-300">
                <div className="flex items-center gap-3 overflow-hidden">
                  <img 
                    src={logoSrc} 
                    alt="Logo NexoSalud" 
                    className="h-10 w-10 object-contain rounded-xl shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800 bg-white dark:bg-[#020617] p-0.5 shrink-0 transition-all"
                  />
                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">NexoSalud</h1>
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 font-mono">BI</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">Clínica Odontológica</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Colapsar barra lateral"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expandir barra lateral"
                className="group relative p-1 rounded-xl transition-all hover:scale-105 animate-in fade-in duration-300"
              >
                <img 
                  src={logoSrc} 
                  alt="Logo NexoSalud" 
                  className="h-10 w-10 object-contain rounded-xl shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-800 bg-white dark:bg-[#020617] p-0.5 shrink-0 group-hover:ring-2 group-hover:ring-teal-500 transition-all"
                />
                <span className="absolute -bottom-1 -right-1 bg-slate-900 dark:bg-slate-700 text-white p-0.5 rounded-full border border-white dark:border-slate-800 shadow">
                  <PanelLeftOpen className="h-3 w-3 text-teal-400" />
                </span>
              </button>
            )}
          </div>

          {/* Nav Menu con scroll interno independiente */}
          <div className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'} overflow-y-auto no-scrollbar`}>
            <Sidebar />
          </div>
        </div>
      </aside>

      {/* Main Workspace Area con scroll independiente */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1360px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
