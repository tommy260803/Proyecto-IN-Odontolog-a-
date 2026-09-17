import { Menu, Database, CreditCard, PanelLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { useSidebar } from '@/shared/context/SidebarContext';

export function Header() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 transition-colors">
      {/* Mobile Menu Toggle */}
      <div className="flex items-center gap-3 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800">
              <Menu className="h-4 w-4 text-slate-700 dark:text-slate-200" />
              <span className="sr-only">Menú de navegación</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col p-6 w-80 bg-white dark:bg-slate-900 dark:border-slate-800">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-bold text-slate-900 dark:text-white mb-6">
              <img 
                src="/Logo_NexoSalud.png" 
                alt="Logo NexoSalud" 
                className="h-9 w-9 object-contain rounded-lg shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700 bg-white p-0.5"
              />
              NexoSalud Odontología
            </SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
        
        <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">NexoSalud BI</span>
      </div>

      {/* Center Context / Search or Active Clinic (Desktop) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Alternar barra lateral"
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-500"></span>
          <span>Sistema de Inteligencia de Negocios & Gestión Clínica</span>
        </div>
      </div>

      {/* Right Actions & Health Indicators */}
      <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
        {/* SQL Server DB Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
          <Database className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span className="font-mono text-slate-700 dark:text-slate-200">NexoSaludDB</span>
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        </div>

        {/* Mercado Pago Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/40 rounded-full text-[11px] font-semibold text-purple-700 dark:text-purple-300">
          <CreditCard className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span>Yape & Card</span>
        </div>

        {/* Dark / Light Mode Toggle */}
        <ThemeToggle />

        {/* Doctor / User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-800 to-teal-700 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-slate-700 shadow-sm">
            DR
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Dr. Benitez</span>
            <span className="text-[10px] text-slate-400 leading-tight">Administrador</span>
          </div>
        </div>
      </div>
    </header>
  );
}
