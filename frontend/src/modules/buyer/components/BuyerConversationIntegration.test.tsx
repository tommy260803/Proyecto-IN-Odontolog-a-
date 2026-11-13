import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerDetailView } from './BuyerDetailView';
import { buyerService } from '../services/buyer.service';
import { staffAuthService } from '@/shared/services/staffAuthService';

const state=vi.hoisted(()=>({turn:{} as any,buyer:{id:'1',personId:'1',person:{firstName:'Persona',lastName:'Sintética'},state:'NEW',currentStage:'BUYER',
  createdAt:'2026-11-12T10:00:00Z',contactAuthorization:false,channel:'QA',attractionSource:'QA'}}));
vi.mock('../hooks/useBuyerQueries',()=>({
  useBuyer:()=>({data:state.buyer,isLoading:false,isError:false}),
  useUpdateBuyer:()=>({isPending:false,mutate:vi.fn()}),useConvertBuyerToLead:()=>({isPending:false,mutate:vi.fn()}),
  useEvaluateBuyer:()=>({isPending:false,mutate:vi.fn()}),
}));
vi.mock('./BuyerConversationPanel',()=>({BuyerConversationPanel:({personId,onCompleted,onTurnChanged}:any)=>
  <button onClick={()=>{onTurnChanged(state.turn,{personId,actorId:7,source:'active'});if(state.turn.status==='COMPLETADA')onCompleted(state.turn);}}>Resultado del chat persona {personId}</button>}));
beforeEach(()=>staffAuthService.saveSession({email:'qa@example.invalid',token:'Q'.repeat(43),expira_en:'2030-01-01T00:00:00Z',usuario:{id_usuario:7,nombres:'QA',apellidos:'Operador',rol:'Administrador'}}));
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();});
describe('Integración del panel en la ficha',()=>{
  it.each([true,false])('refresca la ficha y solo invalida LEAD/journey si hay conversión confirmada: %s',confirmed=>{
    vi.spyOn(buyerService,'getCatalogs').mockResolvedValue({canales:[],fuentes:[],servicios:[],sedes:[],horarios:[],modalidades:[]});
    const client=new QueryClient(),invalidate=vi.spyOn(client,'invalidateQueries').mockResolvedValue();
    state.turn={status:'COMPLETADA',interactionId:21,turnId:10,evaluation:confirmed?{estado:'COMPLETADA',accion:'CONVERSION_LEAD',id_solicitud:30,id_evento_etapa:40}:
      {estado:'COMPLETADA',accion:'CONSERVA_ETAPA_POSTERIOR',etapa_final:'PAYER'}};
    render(<QueryClientProvider client={client}><MemoryRouter><BuyerDetailView buyerId="1"/></MemoryRouter></QueryClientProvider>);
    expect(screen.getByText('Actividades del Agente Buyer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Resultado del chat persona 1'}));
    expect(invalidate).toHaveBeenCalledWith({queryKey:['buyers']});
    for(const queryKey of [['leads'],['lead','opportunities'],['journeys']]){
      if(confirmed)expect(invalidate).toHaveBeenCalledWith({queryKey});
      else expect(invalidate).not.toHaveBeenCalledWith({queryKey});
    }
  });
});
