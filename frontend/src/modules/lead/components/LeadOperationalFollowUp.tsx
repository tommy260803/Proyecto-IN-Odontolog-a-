import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleAlert, FileText, Loader2, Pause, Save, Sparkles, X } from 'lucide-react';
import { LeadWhatsAppStatus } from './LeadWhatsAppStatus';
const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition-colors focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/20 disabled:opacity-50 [color-scheme:light] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-teal-500 dark:focus:bg-slate-950 dark:[color-scheme:dark]';
const stateLabels: Record<string, string> = {
  PROGRAMADO: 'Programado', PAUSADO: 'Pausado', CANCELADO: 'Cancelado',
  PREPARADO: 'Mensaje preparado', ENVIADO: 'Enviado', FALLIDO: 'Envío fallido',
};
const api=(import.meta.env.VITE_API_URL || 'http://localhost:3001/api')+'/lead/operational';
export type LeadPriority={ id_solicitud:number; id_persona:number; orden:number; motivo:string; accion:string; fecha:string|null };
export function useLeadPriorities() {
  return useQuery<LeadPriority[]>({ queryKey:['lead-operational-priorities'],
    queryFn:async()=>{ const r=await fetch(api+'/priorities'); if(!r.ok)throw new Error('No se pudo consultar la prioridad.'); return r.json(); },
    refetchInterval:30000, refetchOnWindowFocus:true });
}
export function LeadOperationalFollowUp({ requestId }:{ requestId:number }) {
  const client=useQueryClient();
  const [date,setDate]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const {data,refetch,isLoading,isError}=useQuery({queryKey:['lead-operational',requestId],queryFn:async()=>{
    const r=await fetch(api+'/'+requestId); const b=await r.json(); if(!r.ok)throw new Error(b.error); return b;
  },refetchInterval:30000});
  const priorities=useLeadPriorities();
  const priority=priorities.data?.find(p=>p.id_solicitud===requestId);
  async function save(accion:string) {
    setBusy(true);setError('');
    try {
      const r=await fetch(api+'/'+requestId,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({accion,motivo:reason,revision:data?.seguimiento?.revision??0,fecha_lima:date})});
      const b=await r.json(); if(!r.ok)throw new Error(b.error);
      await refetch(); await client.invalidateQueries({queryKey:['lead-operational-priorities']});
    } catch(e) {setError(e instanceof Error?e.message:'No se pudo guardar.');await refetch();}
    finally {setBusy(false);}
  }
  const actions = [
    { action: 'programar', label: 'Guardar fecha', Icon: Save },
    { action: 'pausar', label: 'Pausar', Icon: Pause },
    { action: 'cancelar', label: 'Cancelar seguimiento', Icon: X },
    {
      action: data?.seguimiento?.estado === 'PREPARADO' ? 'actualizar_mensaje' : 'preparar',
      label: data?.seguimiento?.estado === 'PREPARADO' ? 'Actualizar mensaje' : 'Preparar mensaje',
      Icon: Sparkles,
    },
  ];
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
          Próximo contacto · {new Date(data.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})}
        </p>}
        {data?.seguimiento && <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {stateLabels[data.seguimiento.estado] ?? data.seguimiento.estado}
        </span>}
      </div>
    </div>}
    {isLoading && <p role="status" className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> Cargando seguimiento…
    </p>}
    {data && !data.instalado && <p role="status" className="text-xs text-amber-800 dark:text-amber-300">Pendiente de instalar el esquema operativo de seguimiento.</p>}
    {data?.whatsapp && <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60" aria-label="Seguimiento de WhatsApp">
      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Última propuesta por WhatsApp</h3>
      <LeadWhatsAppStatus tracking={data.whatsapp} />
      {data.sugerencia_whatsapp && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {data.sugerencia_whatsapp.motivo} · {new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })
            .format(new Date(data.sugerencia_whatsapp.fecha_lima + ':00-05:00'))} (Lima)
        </p>
        <button type="button" disabled={busy || !data.instalado} className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950"
          onClick={() => { setDate(data.sugerencia_whatsapp.fecha_lima); setReason(data.sugerencia_whatsapp.motivo); }}>
          Usar sugerencia
        </button>
      </div>}
    </section>}
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Fecha y hora de Lima
          <input type="datetime-local" value={date} disabled={busy||!data?.instalado} onChange={e=>setDate(e.target.value)} className={fieldClass}/>
        </label>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Motivo y próxima acción
          <input value={reason} disabled={busy||!data?.instalado} maxLength={400} onChange={e=>setReason(e.target.value)}
            placeholder="Indica cuándo y por qué retomar el contacto." className={fieldClass}/>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map(({action,label,Icon}) => <button key={action} type="button"
          disabled={busy||!data?.instalado||!reason.trim()||(action==='programar'&&!date)} onClick={()=>void save(action)}
          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50 ${action==='programar'
            ? 'bg-[#0f766e] text-white hover:bg-teal-800'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}
        </button>)}
      </div>
    </div>
    {data?.seguimiento?.borrador && <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800 dark:bg-teal-950/50">
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200">
        <FileText aria-hidden="true" className="h-3.5 w-3.5" /> Mensaje preparado · pendiente de envío
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">{data.seguimiento.borrador}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Revisa el borrador antes de enviarlo.</p>
    </div>}
    {(error||isError) && <p role="alert" className="inline-flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
      <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{error||'No se pudo cargar el seguimiento.'}
    </p>}
  </section>;
}
