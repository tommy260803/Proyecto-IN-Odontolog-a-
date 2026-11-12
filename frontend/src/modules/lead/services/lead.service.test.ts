import { describe, it, expect, vi, afterEach } from 'vitest';
import { leadService } from './lead.service';
vi.mock('@/application/use-cases/lead',()=>({leadUseCases:{}}));
afterEach(()=>vi.unstubAllGlobals());
describe('CAP-05 HTTP contract',()=>{
  it('does not retry a failed public confirmation against another backend',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Horario ocupado'})});vi.stubGlobal('fetch',fetch);
    await expect(leadService.submitPublicPreReserve(55,{clave_operacion:'same-operation'})).rejects.toThrow('Horario ocupado');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).not.toContain('onrender.com');
  });
  it('propagates a network failure without forwarding the patient data elsewhere',async()=>{
    const fetch=vi.fn().mockRejectedValue(new TypeError('Network error'));vi.stubGlobal('fetch',fetch);
    await expect(leadService.submitPublicPreReserve(55,{clave_operacion:'same-operation'})).rejects.toThrow('Network error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('preserves the operation key and explicit confirmations in the public request',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{reservaId:20,reutilizada:true}})});vi.stubGlobal('fetch',fetch);
    const payload={clave_operacion:'same-operation',aceptacion_explicita:true,autorizacion_reserva:true,consentimiento_contacto:true};
    const result=await leadService.submitPublicPreReserve(55,payload);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(payload);
    expect(result.data).toEqual({reservaId:20,reutilizada:true});
  });
  it('uses a private token when reading the public offer, on the configured backend only',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id_solicitud:9})});vi.stubGlobal('fetch',fetch);
    await leadService.getPublicOffer(55,'private-token');
    expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toContain('token=private-token');
    expect(fetch.mock.calls[0][1].referrerPolicy).toBe('no-referrer');
  });
  it('keeps the real error reason returned by the backend when closing a deal',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'La propuesta venció'})});vi.stubGlobal('fetch',fetch);
    await expect(leadService.reserve('55',{})).rejects.toThrow('La propuesta venció');
  });
});
