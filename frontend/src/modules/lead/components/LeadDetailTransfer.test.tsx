import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { LeadDetailView } from './LeadDetailView';
import { leadService } from '../services/lead.service';
vi.mock('../services/lead.service',()=>({leadService:{getLeadDetails:vi.fn(),getAvailabilityOptions:vi.fn(),transferPreview:vi.fn(),reserve:vi.fn()}}));
vi.mock('@/modules/config/services/config.service',()=>({configService:{getEmpresa:vi.fn().mockResolvedValue({})}}));
vi.mock('@/shared/services/groqService',()=>({predictLeadNegotiationStrategy:vi.fn().mockResolvedValue({})}));
vi.mock('./LeadListView',()=>({renderLeadStatusBadge:()=>null}));
vi.mock('./LeadInteraction',()=>({LeadInteraction:()=>null}));
vi.mock('./LeadOperationalFollowUp',()=>({LeadOperationalFollowUp:()=>null}));
vi.mock('./LeadProfileEditModal',()=>({LeadProfileEditModal:()=>null}));
vi.mock('@/shared/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn(),toasts:[]})}));
const preview={id_solicitud:90,id_opcion:120,huella:'a'.repeat(64),precio:'125.50',servicio:'Evaluación',sede:'Sede de prueba',profesional:'Especialista habilitado',fecha:'2099-08-20',inicio:'09:00',fin:'10:00',vence:'2099-08-19T15:00:00Z'};
beforeEach(()=>{
  vi.clearAllMocks();HTMLElement.prototype.scrollIntoView=vi.fn();
  vi.mocked(leadService.getAvailabilityOptions).mockResolvedValue({servicios:[{id_servicio:7,nombre:'Evaluación',Tarifas:[{precio:125.50}]}],sedes:[],profesionales:[],disponibilidades:[]});
  vi.mocked(leadService.getLeadDetails).mockResolvedValue({id_persona:55,nombres:'Persona',apellidos:'Temporal',Etapa:{nombre:'LEAD'},Solicitudes:[{id_solicitud:90,id_servicio:7,estado:'En negociación',resultado_comercial_lead:'PENDIENTE',Servicio:{nombre:'Evaluación'},Opciones:[{id_opcion:120,precio_ofrecido:125.50,seleccionada:true,estado_respuesta:'Pendiente',Propuesta:{fecha_vigencia_hasta_utc_lead:preview.vence},Disponibilidad:{fecha:'2099-08-20',Sede:{nombre:'Sede de prueba'},Profesional:{nombres:'Especialista',apellidos:'habilitado'}}}]}]});
  vi.mocked(leadService.transferPreview).mockResolvedValue(preview);
});
afterEach(cleanup);
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/lead/55']}><Routes><Route path="/lead/:id" element={<LeadDetailView leadId="55"/>}/><Route path="/payer" element={<p>Destino PAYER</p>}/></Routes></MemoryRouter></QueryClientProvider>);}
it('selection alone cannot reserve; explicit acceptance, authorization and evidence are required',async()=>{
  mount();const close=await screen.findByRole('button',{name:/Cerrar Trato/});await waitFor(()=>expect(close).not.toBeDisabled());fireEvent.click(close);
  await screen.findByRole('dialog');expect(leadService.reserve).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Confirmar reserva y traspaso'})).toBeDisabled();
  expect(leadService.transferPreview).toHaveBeenCalledWith('55',90,120);
});
it('a failed confirmation preserves the key; successful retry navigates to PAYER',async()=>{
  vi.mocked(leadService.reserve).mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValueOnce({data:{reservaId:20}});
  mount();const close=await screen.findByRole('button',{name:/Cerrar Trato/});await waitFor(()=>expect(close).not.toBeDisabled());fireEvent.click(close);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox',{name:/El paciente aceptó/}));fireEvent.click(screen.getByRole('checkbox',{name:/El paciente autorizó/}));
  fireEvent.change(screen.getByRole('textbox',{name:/Referencia de la confirmación/}),{target:{value:'Confirmó por llamada'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirmar reserva y traspaso'}));await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Confirmar reserva y traspaso'}));await screen.findByText('Destino PAYER');
  const calls=vi.mocked(leadService.reserve).mock.calls;
  expect(calls).toHaveLength(2);expect(calls[0][1].clave_operacion).toBe(calls[1][1].clave_operacion);
  expect(calls[1][1]).toMatchObject({id_solicitud:90,id_opcion:120,huella:preview.huella,aceptacion_explicita:true,autorizacion_reserva:true,evidencia:'Confirmó por llamada'});
});
