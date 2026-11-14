import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleAlert, FileText, Loader2, Pause, Save, Sparkles, X } from 'lucide-react';
import { LeadWhatsAppStatus } from './LeadWhatsAppStatus';
import { leadWhatsAppControlChanged, requiresLeadStaff, useLeadStaffSession } from '../services/leadWhatsAppAlerts';
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/20 disabled:opacity-50 [color-scheme:light] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-950 dark:[color-scheme:dark]';
const stateLabels: Record<string, string> = {
  PROGRAMADO: 'Programado', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
  PREPARADO: 'Mensaje preparado', ENVIADO: 'Enviado', FALLIDO: 'Envío fallido',
};
const turns = [
  { value: 'mañana', label: 'Mañana · 8:00 a. m. – 1:00 p. m.', start: '08:00', end: '13:00' },
  { value: 'tarde', label: 'Tarde · 1:00 p. m. – 6:00 p. m.', start: '13:00', end: '18:00' },
  { value: 'noche', label: 'Noche · 6:00 p. m. – 8:00 p. m.', start: '18:00', end: '20:00' },
];
const api=(import.meta.env.VITE_API_URL || 'http://localhost:3001/api')+'/lead/operational';
export type LeadPriority={ id_solicitud:number; id_persona:number; orden:number; motivo:string; accion:string; fecha:string|null };
export function useLeadPriorities() {
  const staff = useLeadStaffSession();
  const headers = staff ? { Authorization: `Bearer ${staff.token}` } : undefined;
  return useQuery<LeadPriority[]>({ queryKey:['lead-operational-priorities', staff?.expira_en],
    enabled: !requiresLeadStaff || Boolean(staff),
    queryFn:async()=>{ const r=await fetch(api+'/priorities', { headers }); if(!r.ok)throw new Error('No se pudo consultar la prioridad.'); return r.json(); },
    refetchInterval:30000, refetchOnWindowFocus:true });
}
// Muestra la prioridad y el próximo contacto de la solicitud, con opciones para programar, pausar o cancelar el seguimiento.
export function LeadOperationalFollowUp({ requestId }:{ requestId:number }) {
  const client=useQueryClient();
  const staff = useLeadStaffSession();
  const headers = staff ? { Authorization: `Bearer ${staff.token}` } : undefined;
  const [date,setDate]=useState('');
  const [turnInput,setTurn]=useState('');
  const [time,setTime]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const {data,refetch,isLoading,isError}=useQuery({queryKey:['lead-operational',requestId,staff?.expira_en],
    enabled: !requiresLeadStaff || Boolean(staff), queryFn:async()=>{
    const r=await fetch(api+'/'+requestId, { headers }); const b=await r.json(); if(!r.ok)throw new Error(b.error); return b;
  },refetchInterval:30000});
  useEffect(() => {
    const refreshControl = () => { void refetch(); };
    window.addEventListener(leadWhatsAppControlChanged, refreshControl);
    return () => window.removeEventListener(leadWhatsAppControlChanged, refreshControl);
  }, [refetch]);
  const priorities=useLeadPriorities();
  const priority=priorities.data?.find(p=>p.id_solicitud===requestId);
  const selectedTurn = turns.find(turn => turn.value === turnInput);
  const validTime = !time || Boolean(selectedTurn && time >= selectedTurn.start && time < selectedTurn.end);
  const canSchedule = data?.automatico_disponible && data?.whatsapp?.contacto_permitido;
  async function save(accion:string) {
    setBusy(true);setError('');
    try {
      const motive = reason.trim() || data?.seguimiento?.motivo;
      const r=await fetch(api+'/'+requestId,{method:'POST',headers:{'Content-Type':'application/json', ...headers},
        body:JSON.stringify({accion,motivo:motive,revision:data?.seguimiento?.revision??0,
          ...(accion === 'programar' ? { fecha_lima:date, turno:turnInput || null, ...(time ? { hora:time } : {}) } : {})})});
      const b=await r.json(); if(!r.ok)throw new Error(b.error);
      await refetch(); await client.invalidateQueries({queryKey:['lead-operational-priorities']});
    } catch(e) {setError(e instanceof Error?e.message:'No se pudo guardar.');await refetch();}
    finally {setBusy(false);}
  }
  const automatic = data?.seguimiento?.origen_whatsapp;
  const turn = data?.seguimiento?.turno_whatsapp;
  const scheduledTime = data?.fecha && new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(data.fecha));
  const showTime = automatic === 'PACIENTE' ? Boolean(data?.seguimiento?.hora_solicitada)
    : automatic === 'ASESOR' ? Boolean(turn) && scheduledTime !== turns.find(item => item.value === turn)?.start : !turn;
  const contactFormat = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', dateStyle: 'medium', ...(showTime ? { timeStyle: 'short' } : {}),
  });
  const actions = [
    { action: 'programar', label: 'Programar envío', Icon: Save },
    { action: 'pausar', label: 'Pausar', Icon: Pause },
    { action: 'cancelar', label: 'Cancelar seguimiento', Icon: X },
    {
      action: data?.seguimiento?.estado === 'PREPARADO' ? 'actualizar_mensaje' : 'preparar',
      label: data?.seguimiento?.estado === 'PREPARADO' ? 'Actualizar mensaje' : 'Preparar mensaje',
      Icon: Sparkles,
    },
  ].filter(({ action }) => action !== 'preparar' && action !== 'actualizar_mensaje' || Boolean(data?.seguimiento?.estado === 'PREPARADO' && !automatic));
  return <section className="space-y-4 px-4 pb-6 sm:px-6" aria-label="Prioridad y seguimiento">
    {(priority || data?.fecha || data?.seguimiento) && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      {priority && <div>
        <h3 className="text-xs font-semibold text-teal-800 dark:text-teal-300">Prioridad operativa</h3>
        <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{priority.motivo}</p>
        <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{priority.accion}</p>
      </div>}
      <div className="flex flex-wrap items-center gap-3">
        {data?.fecha && <p className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />
          Próximo contacto · {contactFormat.format(new Date(data.fecha))}{turn && ` · Turno ${turn}`}
        </p>}
        {data?.seguimiento && <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {stateLabels[data.seguimiento.estado] ?? data.seguimiento.estado}
        </span>}
      </div>
      {automatic && <p className="text-xs text-slate-600 dark:text-slate-300">
        {automatic === 'PACIENTE' && data.seguimiento.estado === 'PROGRAMADO' ? 'Programado por solicitud del cliente' : 'WhatsApp automático'} · {data.seguimiento.motivo}
      </p>}
      {data?.seguimiento?.espera_asesor && <p role="status" className="inline-flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
        <Pause aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        La fecha de contacto está guardada. El envío automático queda en espera hasta devolver el control al ChatBot.
      </p>}
    </div>}
    {isLoading && <p role="status" className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> Cargando seguimiento…
    </p>}
    {data && !data.instalado && <p role="status" className="text-xs text-amber-800 dark:text-amber-300">Pendiente de instalar el esquema operativo de seguimiento.</p>}
    {data?.instalado && !data.automatico_disponible && <p role="status" className="text-xs text-amber-800 dark:text-amber-300">Pendiente de habilitar el seguimiento automático de WhatsApp.</p>}
    {data?.whatsapp && <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60" aria-label="Seguimiento de WhatsApp">
      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Última propuesta por WhatsApp</h3>
      <LeadWhatsAppStatus tracking={data.whatsapp} />
    </section>}
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Fecha de contacto
          <input type="date" value={date} disabled={busy||!canSchedule} onChange={e=>setDate(e.target.value)} className={fieldClass}/>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Turno de Lima (opcional)
          <select value={turnInput} disabled={busy||!canSchedule} onChange={e=>{ setTurn(e.target.value); setTime(''); }} className={fieldClass}>
            <option value="">Cualquier turno</option>
            {turns.map(turn => <option key={turn.value} value={turn.value}>{turn.label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Hora exacta (opcional)
          <input type="time" value={time} min={selectedTurn?.start} aria-invalid={!validTime}
            disabled={busy||!canSchedule||!selectedTurn} onChange={e=>setTime(e.target.value)} className={fieldClass}/>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 sm:col-span-3">Motivo y próxima acción
          <input value={reason} disabled={busy||!data?.instalado} maxLength={400} onChange={e=>setReason(e.target.value)}
            placeholder="Indica cuándo y por qué retomar el contacto." className={fieldClass}/>
        </label>
      </div>
      {!validTime && <p role="alert" className="text-xs text-red-700 dark:text-red-300">La hora debe estar dentro del turno elegido.</p>}
      {data?.automatico_disponible && !data?.whatsapp?.contacto_permitido && <p className="text-xs text-slate-500 dark:text-slate-400">
        Para programar el envío automático, comparte primero una propuesta por WhatsApp con autorización de contacto.
      </p>}
      <div className="flex flex-wrap gap-2">
        {actions.map(({action,label,Icon}) => <button key={action} type="button"
          disabled={busy || !data?.instalado || (action === 'programar' ? !canSchedule || !date || !validTime || !reason.trim()
            : (action === 'preparar' || action === 'actualizar_mensaje') ? Boolean(automatic) || !reason.trim()
              : !reason.trim() && !data?.seguimiento?.motivo)} onClick={()=>void save(action)}
          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50 ${action==='programar'
            ? 'bg-[#0f766e] text-white hover:bg-teal-800'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}
        </button>)}
      </div>
    </div>
    {data?.seguimiento?.borrador && <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800 dark:bg-teal-950/50">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200">
        <FileText aria-hidden="true" className="h-3.5 w-3.5" /> {automatic && data.seguimiento.estado === 'ENVIADO' ? 'Mensaje enviado por WhatsApp'
          : automatic && data.seguimiento.estado === 'FALLIDO' ? 'Mensaje sin confirmación de envío' : 'Mensaje preparado · pendiente de envío'}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{data.seguimiento.borrador}</p>
      {!automatic && <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Revisa el borrador antes de enviarlo.</p>}
    </div>}
    {(error||isError) && <p role="alert" className="inline-flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
      <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{error||'No se pudo cargar el seguimiento.'}
    </p>}
  </section>;
}
