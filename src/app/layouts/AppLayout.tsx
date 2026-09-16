import { Outlet } from 'react-router-dom';
import { Header } from '@/shared/components/layout/Header';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Toaster } from '@/shared/components/ui/toaster';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-1">
        <aside className="hidden border-r bg-background md:block md:w-64 flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <h1 className="text-xl font-bold text-primary">NexoSalud</h1>
          </div>
          <div className="p-4">
            <Sidebar />
          </div>
          <div className="mt-auto p-4 md:hidden">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              Datos demostrativos
            </div>
          </div>
        </aside>
        <div className="flex flex-col flex-1 sm:gap-4 sm:py-4">
          <Header />
          <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <div className="mx-auto grid w-full max-w-6xl gap-2">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
