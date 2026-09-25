import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from '../router';
import { ThemeProvider } from '@/shared/context/ThemeContext';
import { SidebarProvider } from '@/shared/context/SidebarContext';
import { Toaster } from '@/shared/components/ui/toaster';

const queryClient = new QueryClient();

export function AppProviders() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
