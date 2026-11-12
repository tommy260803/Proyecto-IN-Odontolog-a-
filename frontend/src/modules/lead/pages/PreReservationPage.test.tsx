import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import PreReservationPage from './PreReservationPage';
import { leadService } from '../services/lead.service';
vi.mock('../services/lead.service',()=>({leadService:{getPublicOffer:vi.fn(),submitPublicPreReserve:vi.fn()}}));
vi.mock('@/shared/services/groqService',()=>({chatWithNegotiatorAgent:vi.fn()}));
vi.mock('@/shared/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn(),toasts:[],dismiss:vi.fn()})}));
const offer={id_persona:55,firstName:'Persona',lastName:'Temporal',dni:'87654321',phone:'999000111',email:'',
  serviceName:'Evaluación',serviceDescription:'Evaluación',id_servicio:7,offeredPrice:125.50,originalPrice:125.50,discountPct:0,
  fechaOfrecida:'2099-08-20',horaSugerida:'09:00 - 10:00',sedeId:1,sede:'Sede de prueba',doctor:'Especialista habilitado',
  id_solicitud:90,id_opcion:120,huella:'a'.repeat(64),relatedServices:[],catalogServices:[],sedes:[{id_sede:1,nombre:'Sede de prueba'}],expirationDate:'2099-08-19T15:00:00Z'};
beforeEach(()=>{
  vi.clearAllMocks();window.location.hash='token=private-token';
  vi.mocked(leadService.getPublicOffer).mockResolvedValue(offer);
  HTMLElement.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>cleanup());
function mount(){return render(<MemoryRouter initialEntries={['/pre-reserva/55']}><Routes><Route path="/pre-reserva/:id" element={<PreReservationPage/>}/></Routes></MemoryRouter>);}
it('shows the actual appointment and requires separate explicit confirmations',async()=>{
  mount();await screen.findByText('Horario ofrecido:');
  expect(leadService.getPublicOffer).toHaveBeenCalledWith('55','private-token');
  expect(screen.getAllByText(/2099-08-20/).length).toBeGreaterThan(0);
  expect(screen.queryByText('Selecciona el día de tu cita')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox',{name:/Acepto la propuesta/})).not.toBeChecked();
  expect(screen.getByRole('checkbox',{name:/Autorizo reservar/})).not.toBeChecked();
  expect(screen.getByRole('checkbox',{name:/Autorizo el contacto/})).not.toBeChecked();
  expect(screen.getByRole('button',{name:/Confirmar Pre-Reserva/})).toBeDisabled();
});
it('retries a failed confirmation with the same operation key and exact offered conditions',async()=>{
  vi.mocked(leadService.submitPublicPreReserve).mockRejectedValue(new Error('Conexión interrumpida'));
  mount();await screen.findByText('Horario ofrecido:');
  for(const name of [/Acepto la propuesta/,/Autorizo reservar/,/Autorizo el contacto/])fireEvent.click(screen.getByRole('checkbox',{name}));
  const confirm=screen.getByRole('button',{name:/Confirmar Pre-Reserva/});
  fireEvent.click(confirm);await waitFor(()=>expect(leadService.submitPublicPreReserve).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(confirm).not.toBeDisabled());fireEvent.click(confirm);
  await waitFor(()=>expect(leadService.submitPublicPreReserve).toHaveBeenCalledTimes(2));
  const first=vi.mocked(leadService.submitPublicPreReserve).mock.calls[0][1];
  const second=vi.mocked(leadService.submitPublicPreReserve).mock.calls[1][1];
  expect(first.clave_operacion).toBe(second.clave_operacion);
  expect(first).toMatchObject({fecha:'2099-08-20',hora:'09:00 - 10:00',id_solicitud:90,id_opcion:120,
    huella:offer.huella,token:'private-token',aceptacion_explicita:true,autorizacion_reserva:true,consentimiento_contacto:true});
});
