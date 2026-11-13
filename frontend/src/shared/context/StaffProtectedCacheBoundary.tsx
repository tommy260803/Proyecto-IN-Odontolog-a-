import { useLayoutEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { staffAuthService } from '../services/staffAuthService';

export function StaffProtectedCacheBoundary({children}:{children:React.ReactNode}) {
  const client=useQueryClient();
  useLayoutEffect(()=>staffAuthService.subscribe(()=>{
    // Cancelación síncrona antes de admitir otra identidad. Los queryFn consumen
    // AbortSignal y verifican la sesión también después de leer el cuerpo.
    void client.cancelQueries();
    client.clear();
  }),[client]);
  return children;
}
