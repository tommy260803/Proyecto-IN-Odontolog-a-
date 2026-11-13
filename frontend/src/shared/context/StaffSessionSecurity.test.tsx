import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffAuthProvider } from './StaffAuthContext';
import { StaffProtectedCacheBoundary } from './StaffProtectedCacheBoundary';
import { staffAuthService } from '../services/staffAuthService';
import { useBuyer } from '@/modules/buyer/hooks/useBuyerQueries';
const wire={token:'Q'.repeat(43),expira_en:'2030-01-01T00:00:00.000Z',usuario:{id_usuario:7,nombres:'QA',apellidos:'Operador',rol:'Administrador'}};
const account={...wire,email:'qa@example.invalid'};
const storedKey='nexosalud_staff_session_v1';
const json=(v:unknown)=>new Response(JSON.stringify(v),{status:200});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();sessionStorage.clear();});
describe('Login y restauración estricta de la sesión',()=>{
  const invalid=[['token corto',{token:'invalido'}],['sin vencimiento',{expira_en:undefined}],['fecha ilegible',{expira_en:'mañana'}],
    ['fecha de calendario imposible',{expira_en:'2030-02-31T00:00:00Z'}],['vencida',{expira_en:'2020-01-01T00:00:00Z'}],
    ['ID negativo',{usuario:{...wire.usuario,id_usuario:-1}}],['ID decimal',{usuario:{...wire.usuario,id_usuario:1.5}}],
    ['ID textual',{usuario:{...wire.usuario,id_usuario:'7'}}],['identidad incompleta',{usuario:{...wire.usuario,apellidos:' '}}],
    ['rol no admitido',{usuario:{...wire.usuario,rol:'Paciente'}}]] as const;
  it.each(invalid)('rechaza respuesta de login: %s',async(_label,override)=>{
    vi.stubGlobal('fetch',vi.fn(async()=>json({...wire,...override})));
    await expect(staffAuthService.authenticate('qa@example.invalid','Solo fixture')).rejects.toThrow();
    expect(staffAuthService.getSession()).toBeNull();expect(localStorage.getItem(storedKey)).toBeNull();
  });
  it.each(invalid)('rechaza una sesión restaurada: %s',(_label,override)=>{
    staffAuthService.saveSession(account);const saved=JSON.parse(localStorage.getItem(storedKey)!);
    localStorage.setItem(storedKey,JSON.stringify({...saved,...override}));expect(staffAuthService.getSession()).toBeNull();
    expect(localStorage.getItem(storedKey)).toBeNull();
  });
  it('rechaza identidad plana que no coincide con la identidad del Bearer guardado',()=>{
    staffAuthService.saveSession(account);const saved=JSON.parse(localStorage.getItem(storedKey)!);
    localStorage.setItem(storedKey,JSON.stringify({...saved,id_usuario:99}));expect(staffAuthService.getSession()).toBeNull();
  });
  it('acepta solo el contrato completo y no altera espacios de la contraseña',async()=>{
    const fetchMock=vi.fn(async(_url:string,_init:RequestInit)=>json(wire));vi.stubGlobal('fetch',fetchMock);
    const session=await staffAuthService.authenticate(' QA@example.invalid ','  Solo fixture  ');
    expect(session.usuario).toEqual(wire.usuario);expect(staffAuthService.getSession()?.token).toBe(wire.token);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).password).toBe('  Solo fixture  ');
  });
  it('logout cancela un login en vuelo aunque fetch ignore abort',async()=>{
    let release!:(r:Response)=>void;const fetchMock=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(r=>{release=r;}));vi.stubGlobal('fetch',fetchMock);
    const login=staffAuthService.authenticate('qa@example.invalid','Solo fixture');const rejected=expect(login).rejects.toThrow(/cancelado/);
    staffAuthService.logout();expect(fetchMock.mock.calls[0][1].signal!.aborted).toBe(true);release(json(wire));await rejected;
    expect(staffAuthService.getSession()).toBeNull();
  });
});
function Probe(){const {data}=useBuyer('1');return <div>{data?.latestEvaluation?.explicacion || 'Sin evaluación protegida'}</div>;}
describe('Ficha real y caché con petición en vuelo (fetch simulado)',()=>{
  it.each(['logout','operator'] as const)('%s aborta ficha y evita restauración tardía en caché',async change=>{
    staffAuthService.saveSession(account);let release!:(v:any)=>void,captured:RequestInit|undefined;
    const body=new Promise<any>(r=>{release=r;});
    const fetchMock=vi.fn(async(_url:string,init:RequestInit={})=>{
      if(init.method==='DELETE')return new Response(null,{status:204});
      if(!captured){captured=init;return {ok:true,json:()=>body} as Response;}
      return json({id:'1',latestEvaluation:null});
    });vi.stubGlobal('fetch',fetchMock);
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<StaffAuthProvider><QueryClientProvider client={client}><StaffProtectedCacheBoundary><Probe/></StaffProtectedCacheBoundary></QueryClientProvider></StaffAuthProvider>);
    await waitFor(()=>expect(captured).toBeDefined());client.setQueryData(['lead','opportunities'],{private:'PRIVADO_EN_CACHE'});
    act(()=>{
      if(change==='logout')staffAuthService.logout();
      else staffAuthService.saveSession({...account,token:'N'.repeat(43),usuario:{id_usuario:8,nombres:'Otro',apellidos:'Operador',rol:'Administrador'}});
    });
    expect(captured!.signal?.aborted).toBe(true);expect(client.getQueryData(['lead','opportunities'])).toBeUndefined();
    await act(async()=>release({id:'1',latestEvaluation:{explicacion:'PRIVADO_RESPUESTA_TARDIA'}}));
    expect(screen.queryByText('PRIVADO_RESPUESTA_TARDIA')).not.toBeInTheDocument();
    expect(JSON.stringify(client.getQueryCache().getAll().map(q=>q.state.data))).not.toContain('PRIVADO_');
    client.clear();
  });
});
