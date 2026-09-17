import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/layout/Header';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Toaster } from '@/shared/components/ui/toaster';

export default function AppLayout() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="flex flex-1">
        {/* Sidebar Desktop */}
        <aside className="hidden border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 md:flex md:w-72 flex-col justify-between shadow-[1px_0_10px_rgba(0,0,0,0.02)] transition-colors duration-200">
          <div>
            {/* Brand Header */}
            <div className="flex h-20 items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 px-6">
              <img 
                src="/Logo_NexoSalud.png" 
                alt="Logo NexoSalud" 
                className="h-10 w-10 object-contain rounded-xl shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700 bg-white p-0.5"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">NexoSalud</h1>
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60 font-mono">BI</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Clínica Odontológica</p>
              </div>
            </div>

            {/* Nav Menu */}
            <div className="p-4">
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
