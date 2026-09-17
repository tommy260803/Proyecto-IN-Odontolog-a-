import { useTheme } from '@/shared/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      className="h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 shadow-sm"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 rotate-0 scale-100 transition-all" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 -rotate-90 scale-100 transition-all" />
      )}
      <span className="sr-only">Alternar modo oscuro/claro</span>
    </Button>
  );
}

