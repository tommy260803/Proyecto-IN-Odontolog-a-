import { beforeEach,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({session:null as null|{token:string}}));
vi.mock('@/shared/services/staffAuthService',()=>({staffAuthService:{getSession:()=>state.session}}));
import {buyerService} from './buyer.service';
beforeEach(()=>{state.session={token:'real-session-placeholder'};vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:99})}));});
it('envía el Bearer vigente en catálogos, deduplicación y creación administrativa',async()=>{
 await buyerService.getCatalogs();await buyerService.checkDuplicate({phone:'900000001'});await buyerService.createBuyer({firstName:'QA'});
 const calls=vi.mocked(fetch).mock.calls;expect(calls).toHaveLength(3);
 for(const [,init] of calls)expect(init?.headers).toMatchObject({Authorization:'Bearer real-session-placeholder'});
 expect(calls[2][1]?.body).toBe(JSON.stringify({firstName:'QA'}));
});
it('sin sesión no intenta una escritura administrativa',async()=>{
 state.session=null;await expect(buyerService.createBuyer({firstName:'QA'})).rejects.toThrow('Inicia sesión');expect(fetch).not.toHaveBeenCalled();
});
it('una respuesta tardía de creación no se entrega a otra sesión',async()=>{
 vi.mocked(fetch).mockImplementationOnce(async()=>{state.session={token:'other'};return {ok:true,json:async()=>({id:99})} as Response;});
 await expect(buyerService.createBuyer({firstName:'QA'})).rejects.toMatchObject({name:'AbortError'});
});
