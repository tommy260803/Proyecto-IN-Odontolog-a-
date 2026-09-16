import { Menu } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Sidebar } from './Sidebar';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menú de navegación</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <SheetTitle className="text-xl font-bold text-primary mb-4">
            NexoSalud
          </SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-secondary"></div>
          Datos demostrativos
        </div>
      </div>
    </header>
  );
}
