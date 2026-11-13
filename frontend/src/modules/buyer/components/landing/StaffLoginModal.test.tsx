import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StaffLoginModal } from './StaffLoginModal';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('el único login general abre campos vacíos sin perfiles de ejemplo ni descargar cuentas',()=>{
  const fetchMock=vi.fn(()=>{throw Error('NO_REQUEST_EXPECTED');});vi.stubGlobal('fetch',fetchMock);
  render(<StaffLoginModal open onOpenChange={vi.fn()} onSuccessLogin={vi.fn()}/>);
  expect(screen.getByLabelText('Correo institucional')).toHaveValue('');
  expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  expect(screen.queryByText(/Perfiles autorizados/)).not.toBeInTheDocument();expect(fetchMock).not.toHaveBeenCalled();
});
