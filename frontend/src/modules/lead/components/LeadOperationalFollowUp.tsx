import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const {data,refetch}=useQuery({queryKey:['lead-operational',requestId],queryFn:async()=>{
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
  return <section className="space-y-3 border-t p-6">
    <h2 className="text-sm font-semibold">Prioridad y seguimiento</h2>
    {priority && <p className="text-sm">{priority.motivo} · {priority.accion}</p>}
    {data?.fecha && <p className="text-sm">Próximo contacto · {new Date(data.fecha).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p>}
    {data?.seguimiento && <p className="text-sm">Estado · {data.seguimiento.estado}</p>}
    {data && !data.instalado && <p role="status" className="text-sm">Pendiente de instalar el esquema operativo de seguimiento.</p>}
    <label className="block text-sm">Fecha y hora de Lima
      <input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className="ml-2 rounded border bg-background p-2"/>
    </label>
    <label className="block text-sm">Motivo y próxima acción
      <input value={reason} maxLength={400} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded border bg-background p-2"/>
    </label>
    <div className="flex flex-wrap gap-2">
      {['programar','pausar','cancelar','preparar'].map((action,index)=><button key={action} type="button"
        disabled={busy||!data?.instalado||!reason.trim()||(action==='programar'&&!date)} onClick={()=>void save(action)}
        className="rounded border px-3 py-2 text-sm disabled:opacity-50">
        {['Guardar fecha','Pausar','Cancelar seguimiento','Preparar mensaje'][index]}
      </button>)}
    </div>
    {data?.seguimiento?.borrador && <div className="rounded border p-3">
      <p className="mb-2 text-xs font-medium">Mensaje preparado · pendiente de envío</p>
      <p className="whitespace-pre-wrap text-sm">{data.seguimiento.borrador}</p>
    </div>}
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
