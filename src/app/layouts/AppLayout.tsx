import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/layout/Header';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Toaster } from '@/shared/components/ui/toaster';
import { useSidebar } from '@/shared/context/SidebarContext';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function AppLayout() {
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="flex flex-1">
        {/* Sidebar Desktop Collapsible / Expandable */}
        <aside 
          className={`hidden border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 md:flex flex-col justify-between shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Brand Header & Toggle */}
            <div className={`flex h-20 items-center border-b border-slate-200/80 dark:border-slate-800 transition-all ${
              isCollapsed ? 'justify-center px-2' : 'justify-between px-5'
            }`}>
              <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
                <img 
                  src="/Logo_NexoSalud.png" 
                  alt="Logo NexoSalud" 
                  className="h-10 w-10 object-contain rounded-xl shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700 bg-white p-0.5 shrink-0"
                />
                {!isCollapsed && (
                  <div className="flex flex-col truncate">
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">NexoSalud</h1>
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 font-mono">BI</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">Clínica Odontológica</p>
                  </div>
                )}
              </div>

              {/* Toggle Button */}
              <button
                type="button"
                onClick={toggleSidebar}
                title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
                className={`p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                  isCollapsed ? 'hidden' : 'block'
                }`}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* If collapsed, show subtle expand button at top of nav */}
            {isCollapsed && (
              <div className="flex justify-center pt-2 pb-1">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Expandir barra lateral"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Nav Menu */}
            <div className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'} overflow-hidden`}>
              <Sidebar />
            </div>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1360px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
