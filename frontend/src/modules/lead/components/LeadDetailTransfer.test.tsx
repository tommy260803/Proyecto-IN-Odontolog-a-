import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { LeadDetailView } from './LeadDetailView';
import { leadService } from '../services/lead.service';
vi.mock('../services/lead.service',()=>({leadService:{getLeadDetails:vi.fn(),getAvailabilityOptions:vi.fn(),transferPreview:vi.fn(),reserve:vi.fn(),addAlternative:vi.fn(),updateAlternativeDiscount:vi.fn()}}));
vi.mock('@/modules/config/services/config.service',()=>({configService:{getEmpresa:vi.fn().mockResolvedValue({})}}));
vi.mock('./LeadListView',()=>({renderLeadStatusBadge:()=>null}));
vi.mock('./LeadInteraction',()=>({LeadInteraction:({onUpdateProposal, requestId}: any)=><button type="button" data-request={requestId} onClick={() => void onUpdateProposal(
  { id_opcion: 120, id_propuesta: 20, horario: {
    id_disponibilidad: 301, id_sede: 1, id_profesional: 2, fecha: '2099-08-20', inicio: '09:00', fin: '09:30',
  } },
)}>Actualizar desde WhatsApp</button>}));
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
function mount(path = '/lead/55'){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path="/lead/:id/*" element={<LeadDetailView leadId="55"/>}/><Route path="/payer" element={<p>Destino PAYER</p>}/></Routes></MemoryRouter></QueryClientProvider>);}

it('compara las versiones de la misma tarjeta solo si cambian sus condiciones', async () => {
  const lead = await leadService.getLeadDetails('55');
  const [request] = lead.Solicitudes;
  const [option] = request.Opciones;
  const initial = { precio: '125.50', sede: 'Centro Histórico', especialista: 'Valeria Mendoza', servicio: 'Evaluación',
    fecha: '2099-08-20', inicio: '09:00', fin: '09:30', vigencia: preview.vence, promocion: null };
  const current = { ...option, propuesta_inicial: initial, Disponibilidad: {
    fecha: '2099-08-20', hora_inicio: '1970-01-01T09:00:00Z', hora_fin: '1970-01-01T09:30:00Z',
    Sede: { nombre: 'California' }, Profesional: { nombres: 'Ana', apellidos: 'Valeras' },
  } };
  vi.mocked(leadService.getLeadDetails).mockResolvedValue({ ...lead, Solicitudes: [{ ...request, Opciones: [current, {
    ...current, id_opcion: 121, seleccionada: false, propuesta_inicial: { ...initial, sede: 'California', especialista: 'Ana Valeras' },
  }] }] });
  mount();
  const tabs = await screen.findByRole('tablist', { name: 'Versiones de la propuesta' });
  const panel = screen.getByRole('tabpanel');
  expect(within(panel).getByText('California')).toBeInTheDocument();
  expect(within(panel).getByText('Ana Valeras')).toBeInTheDocument();
  expect(within(panel).getAllByText('(actualizado)')).toHaveLength(2);
  fireEvent.click(within(tabs).getByRole('tab', { name: 'Propuesta inicial' }));
  expect(within(panel).getByText('Centro Histórico')).toBeInTheDocument();
  expect(within(panel).getByText('Valeria Mendoza')).toBeInTheDocument();
  expect(within(panel).getByText('S/ 125.50')).toBeInTheDocument();
  expect(within(panel).queryByText('California')).toBeNull();
});

it('edita el descuento y muestra el importe y la versión devueltos por el servidor', async () => {
  const lead = await leadService.getLeadDetails('55');
  const [request] = lead.Solicitudes;
  const [option] = request.Opciones;
  const proposal = { ...option.Propuesta, id_propuesta: 20, id_servicio: 7, estado: 'Pendiente' };
  vi.mocked(leadService.getLeadDetails).mockResolvedValue({ ...lead, Solicitudes: [{
    ...request, Opciones: [{ ...option, id_propuesta_lead: 20, Propuesta: proposal }],
  }] });
  vi.mocked(leadService.getAvailabilityOptions).mockResolvedValue({
    servicios: [{ id_servicio: 7, nombre: 'Evaluación', descuentoMaximo: 15, Tarifas: [{ id_tarifa: 2, precio: 125.50 }] }],
    sedes: [], profesionales: [], disponibilidades: [],
  });
  vi.mocked(leadService.updateAlternativeDiscount).mockResolvedValue({ data: {
    id_opcion: 120, id_propuesta_lead: 21, precio_ofrecido: '116.09',
    Propuesta: { ...proposal, id_propuesta: 21, promocion_aplicada: 'Promoción (-7.5%)' },
  } });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Editar descuento' }));
  const discount = screen.getByRole('dialog').querySelector('input')!;
  expect(discount).toHaveAccessibleName('Descuento (%)');
  fireEvent.change(discount, { target: { value: '15.01' } });
  expect(screen.getByRole('button', { name: 'Guardar descuento' })).toBeDisabled();
  fireEvent.change(discount, { target: { value: '7,5' } });
  expect(screen.getByRole('dialog')).toHaveTextContent('S/ 116.09');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar descuento' }));
  await waitFor(() => expect(leadService.updateAlternativeDiscount).toHaveBeenCalledWith(90, 120,
    { id_propuesta: 20, id_tarifa: 2, tarifa_base: '125.50', descuento_pct: 7.5 }, undefined));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getAllByText('S/ 116.09').length).toBeGreaterThan(0);
});

it('abre la conversación de la solicitud indicada en la alerta aunque exista una más reciente', async () => {
  const data = await leadService.getLeadDetails('55');
  const [request] = data.Solicitudes;
  vi.mocked(leadService.getLeadDetails).mockResolvedValue({
    ...data, Solicitudes: [{ ...request, id_solicitud: 91 }, request],
  });
  mount('/lead/55/negotiation?solicitud=90&conversacion=whatsapp');
  const conversation = await screen.findByRole('button', { name: 'Actualizar desde WhatsApp' });
  expect(conversation).toHaveAttribute('data-request', '90');
  expect(conversation.closest('details')).toHaveAttribute('open');
});

it.each([
  { description: 'solo las horas', original: { id_sede: 1, id_profesional: 2, fecha: '2099-08-20' }, changedAll: false },
  { description: 'la sede, el especialista y el horario', original: { id_sede: 3, id_profesional: 1, fecha: '2099-08-19' }, changedAll: true },
])('aplica el horario elegido y resalta $description respecto a la oferta enviada', async ({ original, changedAll }) => {
  const specialists = [1, 2].map(id => ({
    id_profesional: id, nombres: 'Especialista', apellidos: String(id),
    ProfesionalServicio: [{ id_servicio: 7 }],
  }));
  const branch = { id_sede: 1, nombre: 'Sede de prueba' };
  const availability = specialists.map((professional, index) => ({
    id_disponibilidad: 300 + index, id_sede: branch.id_sede, id_profesional: professional.id_profesional,
    fecha: '2099-08-20', hora_inicio: '1970-01-01T09:00:00.000Z', hora_fin: '1970-01-01T09:30:00.000Z',
    Sede: branch, Profesional: professional,
  }));
  vi.mocked(leadService.getAvailabilityOptions).mockResolvedValue({
    servicios: [{ id_servicio: 7, nombre: 'Evaluación', descuentoMaximo: 15, Tarifas: [{ precio: 125.50 }] }],
    sedes: [branch], profesionales: specialists, disponibilidades: availability,
  });
  vi.mocked(leadService.addAlternative).mockResolvedValue({ data: { id_propuesta_lead: 42 } });

  mount();
  const date = await screen.findByRole('button', { name: 'Elegir fecha' });
  const start = screen.getByLabelText('Hora inicial');
  const end = screen.getByLabelText('Hora final');
  expect(start).toBeDisabled();
  fireEvent.click(date);
  expect(await screen.findByRole('button', { name: /19 de agosto de 2099/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /20 de agosto de 2099/ }));
  expect(end).toBeDisabled();
  fireEvent.keyDown(start, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: '9:00 a. m.' }));
  fireEvent.keyDown(end, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: '9:30 a. m.' }));
  const add = screen.getByRole('button', { name: 'Añadir Propuesta a la Mesa' });
  fireEvent.click(add);
  expect(leadService.addAlternative).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Especialista Sugerido'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '7.5' } });
  fireEvent.click(add);
  await waitFor(() => expect(leadService.addAlternative).toHaveBeenCalledWith('55', expect.objectContaining({
    id_disponibilidad: 301, descuento_pct: 7.5, precio_ofrecido: '116.09', promocion_aplicada: 'Promoción (-7.5%)',
  })));

  await screen.findByRole('heading', { name: 'Persona Temporal' });
  fireEvent.change(screen.getByLabelText('Especialista Sugerido'), { target: { value: '1' } });
  vi.mocked(leadService.transferPreview).mockResolvedValue({
    ...preview, ...original, inicio: '10:00', fin: '10:30', id_propuesta: 20, promocion: 'Promoción registrada',
  });
  vi.mocked(leadService.addAlternative).mockResolvedValue({ data: { id_opcion: 123, id_propuesta_lead: 20 } });
  fireEvent.click(screen.getByText('4. Conversación de negociación'));
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar desde WhatsApp' }));
  await screen.findByText(/Horario cargado desde WhatsApp/);
  const branchField = screen.getByLabelText('Sede Clínica');
  const professionalField = screen.getByLabelText('Especialista Sugerido');
  const updatedDate = screen.getByRole('button', { name: /Fecha:/ });
  expect(branchField).toHaveValue('1');
  expect(professionalField).toHaveValue('2');
  const initialHour = screen.getByLabelText('Hora inicial');
  const finalHour = screen.getByLabelText('Hora final');
  for (const field of [initialHour, finalHour]) {
    expect(field).toHaveAttribute('data-actualizado', 'true');
  }
  for (const field of [branchField, professionalField, updatedDate]) {
    if (changedAll) expect(field).toHaveAttribute('data-actualizado', 'true');
    else expect(field).not.toHaveAttribute('data-actualizado');
  }
  fireEvent.focus(initialHour);
  expect(initialHour).not.toHaveAttribute('data-actualizado');
  expect(finalHour).toHaveAttribute('data-actualizado', 'true');
  expect(screen.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeDisabled();
  expect(leadService.transferPreview).toHaveBeenCalledWith('55', 90, 120, true);
  fireEvent.click(screen.getByRole('button', { name: 'Añadir Propuesta a la Mesa' }));
  await waitFor(() => expect(leadService.addAlternative).toHaveBeenLastCalledWith('55', expect.objectContaining({
    id_disponibilidad: 301, id_propuesta_lead: 20, crear_version_propuesta: false,
    precio_ofrecido: '125.50', promocion_aplicada: 'Promoción registrada',
  })));
  await screen.findByRole('heading', { name: 'Persona Temporal' });
  expect(screen.getByLabelText('Especialista Sugerido')).not.toHaveAttribute('data-actualizado');
  expect(screen.getByLabelText('Hora final')).not.toHaveAttribute('data-actualizado');
});
it('selection alone cannot reserve; explicit acceptance, authorization and evidence are required',async()=>{
  mount();const close=await screen.findByRole('button',{name:/Verificar y pasar a PAYER/});await waitFor(()=>expect(close).not.toBeDisabled());fireEvent.click(close);
  await screen.findByRole('dialog');expect(leadService.reserve).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Confirmar reserva y traspaso'})).toBeDisabled();
  expect(leadService.transferPreview).toHaveBeenCalledWith('55',90,120);
});
it('a failed confirmation preserves the key; successful retry navigates to PAYER',async()=>{
  vi.mocked(leadService.reserve).mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValueOnce({data:{reservaId:20}});
  mount();const close=await screen.findByRole('button',{name:/Verificar y pasar a PAYER/});await waitFor(()=>expect(close).not.toBeDisabled());fireEvent.click(close);
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox',{name:/El paciente aceptó/}));fireEvent.click(screen.getByRole('checkbox',{name:/El paciente autorizó/}));
  fireEvent.change(screen.getByRole('textbox',{name:/Referencia de la confirmación/}),{target:{value:'Confirmó por llamada'}});
  fireEvent.click(screen.getByRole('button',{name:'Confirmar reserva y traspaso'}));await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Confirmar reserva y traspaso'}));await screen.findByText('Destino PAYER');
  const calls=vi.mocked(leadService.reserve).mock.calls;
  expect(calls).toHaveLength(2);expect(calls[0][1].clave_operacion).toBe(calls[1][1].clave_operacion);
  expect(calls[1][1]).toMatchObject({id_solicitud:90,id_opcion:120,huella:preview.huella,aceptacion_explicita:true,autorizacion_reserva:true,evidencia:'Confirmó por llamada'});
});
