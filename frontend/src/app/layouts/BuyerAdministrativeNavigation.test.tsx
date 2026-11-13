import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {StaffAuthProvider,useStaffAuth} from '@/shared/context/StaffAuthContext';
import {staffAuthService} from '@/shared/services/staffAuthService';
import AppLayout from './AppLayout';
vi.mock('@/shared/context/SidebarContext',()=>({CLINIC_BRANCH_OPTIONS:[],useSidebar:()=>({isCollapsed:true,toggleSidebar:vi.fn(),activeBranch:'QA',setActiveBranch:vi.fn()})}));
vi.mock('@/shared/context/ThemeContext',()=>({useTheme:()=>({theme:'light'})}));
vi.mock('@/shared/components/layout/Sidebar',()=>({Sidebar:()=>null}));
vi.mock('@/shared/components/layout/Header',()=>({Header:()=>{const auth=useStaffAuth();return <button onClick={auth.openLoginModal}>Acceso personal</button>;}}));
vi.mock('@/shared/components/ui/toaster',()=>({Toaster:()=>null}));
function BuyerDestination(){const {session}=useStaffAuth();return <div>Listado Buyer; operador {session?.id_usuario}</div>;}
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
it('login general real del layout conserva la sesión y navega al destino Buyer (HTTP simulado)',async()=>{
 localStorage.clear();
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({token:'t'.repeat(43),expira_en:new Date(Date.now()+600000).toISOString(),usuario:{id_usuario:5,nombres:'QA',apellidos:'Administrador',rol:'Administrador'}})}));
 render(<MemoryRouter initialEntries={['/inicio-qa']}><StaffAuthProvider><Routes><Route element={<AppLayout/>}><Route path="/inicio-qa" element={<p>Inicio</p>}/><Route path="/buyer" element={<BuyerDestination/>}/></Route></Routes></StaffAuthProvider></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Acceso personal'}));
 fireEvent.change(screen.getByLabelText('Correo institucional'),{target:{value:'qa@example.invalid'}});
 fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'synthetic-test-input-only'}});
 fireEvent.submit(screen.getByLabelText('Contraseña').closest('form')!);
 await waitFor(()=>expect(screen.getByText('Listado Buyer; operador 5')).toBeInTheDocument());
 expect(staffAuthService.getSession()?.usuario.id_usuario).toBe(5);
 expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/lead/commercial/staff/session');
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
