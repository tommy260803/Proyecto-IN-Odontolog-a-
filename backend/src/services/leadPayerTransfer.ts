import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export class TransferError extends Error {
  constructor(message:string, readonly status=409) { super(message); }
}
export const transferIsolation = { isolationLevel:Prisma.TransactionIsolationLevel.Serializable, timeout:15000, maxWait:5000 } as const;
export const hashAccess = (token:string) => createHash('sha256').update(token).digest('hex');
export function transferId(value:unknown):number {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)>2147483647)
    throw new TransferError('Identificador inválido.',400);
  return Number(value);
}
export async function assertTransferSchema(tx:Prisma.TransactionClient) {
  const [row]=await tx.$queryRaw<{ok:number}[]>`SELECT CASE WHEN OBJECT_ID('dbo.TraspasosPayerLead','U') IS NOT NULL
    AND OBJECT_ID('dbo.AccesosPreReservaLead','U') IS NOT NULL THEN 1 ELSE 0 END ok`;
  if(!row?.ok)throw new TransferError('Falta instalar el incremento 11_TRASPASO_PAYER_LEAD.sql.');
}
export async function transferLock(tx:Prisma.TransactionClient) {
  const [lock]=await tx.$queryRaw<{code:number}[]>`DECLARE @r int;
    EXEC @r=sys.sp_getapplock @Resource=N'NexoSalud:LEAD:PAYER',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=3000;
    SELECT @r code;`;
  if(!lock||lock.code<0)throw new TransferError('Hay otra reserva en curso. Reintenta la misma confirmación.');
}
export async function loadTransferOffer(tx:Prisma.TransactionClient, personId:number, requestId:number, optionId:number) {
  const request=await tx.solicitudes.findFirst({where:{id_solicitud:requestId,id_persona:personId},
    include:{Persona:{include:{Etapa:true}},Servicio:true}});
  const option=await tx.opciones.findFirst({where:{id_opcion:optionId,id_solicitud:requestId},
    include:{Propuesta:true,Disponibilidad:{include:{Sede:true,Profesional:true}}}});
  if(!request||!option||!option.Propuesta)throw new TransferError('La alternativa y su propuesta deben pertenecer a esta solicitud.');
  const p=option.Propuesta,d=option.Disponibilidad;
  const huella=hashAccess(JSON.stringify([personId,requestId,optionId,p.id_propuesta,p.numero_version,
    p.precio_cotizado.toFixed(2),p.fecha_vigencia_hasta_utc_lead?.toISOString()??null,
    option.precio_ofrecido.toFixed(2),d.id_disponibilidad,d.id_sede,d.id_profesional,
    d.fecha.toISOString().slice(0,10),d.hora_inicio.toISOString().slice(11,19),d.hora_fin.toISOString().slice(11,19)]));
  return {request,option,proposal:p,slot:d,huella};
}
export async function checkTransferOffer(tx:Prisma.TransactionClient, offer:Awaited<ReturnType<typeof loadTransferOffer>>) {
  const {request:r,option:o,proposal:p,slot:d}=offer;
  if(r.Persona.Etapa.nombre!=='LEAD'||r.archivada_lead_en||!['Abierta','En negociación'].includes(r.estado)||
    r.resultado_comercial_lead==='CERRADA_SIN_ACUERDO')throw new TransferError('La solicitud no admite un nuevo traspaso desde LEAD.');
  if(o.archivada_lead_en||o.estado_respuesta==='Rechazada'||p.estado==='Rechazada'||p.id_solicitud!==r.id_solicitud||
    p.id_servicio!==r.id_servicio||!o.precio_ofrecido.equals(p.precio_cotizado))throw new TransferError('La propuesta y la alternativa no tienen condiciones comerciales compatibles.');
  if(!p.fecha_vigencia_hasta_utc_lead||p.fecha_vigencia_hasta_utc_lead<=new Date())throw new TransferError('La vigencia del precio venció o no está documentada. Solicita una propuesta vigente.');
  const newer=await tx.$queryRaw<{id:number}[]>`SELECT TOP(1) v.id_propuesta id FROM dbo.PropuestasEconomicasLead v
    WHERE COALESCE(v.id_propuesta_raiz,v.id_propuesta)=${p.id_propuesta_raiz??p.id_propuesta} AND v.numero_version>${p.numero_version}`;
  if(newer.length)throw new TransferError('La propuesta fue sustituida. Revisa la versión actual.');
  if(r.resultado_comercial_lead==='ACEPTADA' && (r.id_propuesta_aceptada_lead!==p.id_propuesta||!r.valor_acordado_lead?.equals(p.precio_cotizado)))
    throw new TransferError('Ya existe un acuerdo con otras condiciones.');
  const authorized=await tx.profesionalServicio.findFirst({where:{id_profesional:d.id_profesional,id_servicio:p.id_servicio}});
  const nowLima=new Date(Date.now()-5*3600000).toISOString();
  const start=d.fecha.toISOString().slice(0,10)+'T'+d.hora_inicio.toISOString().slice(11,19);
  if(!authorized||!r.Servicio?.activo||!d.Profesional.activo||!d.Sede.activo||d.estado!=='Disponible'||start<=nowLima.slice(0,19)||d.hora_fin<=d.hora_inicio)
    throw new TransferError('El horario ya no es futuro, libre o compatible con el servicio y especialista.');
  const [snapshot]=await tx.$queryRaw<{ok:number}[]>`SELECT TOP(1) 1 ok FROM (
      SELECT TOP(1) * FROM dbo.HistorialOpcionesLead WHERE id_opcion=${o.id_opcion}
      ORDER BY fecha_observacion_utc DESC,id_historial DESC) h
    WHERE h.accion<>'DELETE' AND h.id_solicitud=${r.id_solicitud} AND h.id_disponibilidad=${d.id_disponibilidad}
      AND h.id_sede=${d.id_sede} AND h.id_profesional=${d.id_profesional}
      AND h.fecha_disponibilidad=CONVERT(date,${d.fecha})
      AND CONVERT(varchar(8),h.hora_inicio,108)=${d.hora_inicio.toISOString().slice(11,19)}
      AND CONVERT(varchar(8),h.hora_fin,108)=${d.hora_fin.toISOString().slice(11,19)}`;
  if(!snapshot)throw new TransferError('El horario actual no coincide con la alternativa ofrecida y su historial.');
  if(await tx.reservas.findFirst({where:{OR:[{id_solicitud:r.id_solicitud},{Opcion:{id_disponibilidad:d.id_disponibilidad},estado:{notIn:['Cancelada','Vencida']}}]}}))
    throw new TransferError('Existe una reserva previa o el horario está ocupado. No se creará otra.');
  const [overlap]=await tx.$queryRaw<{id:number}[]>`SELECT TOP(1) rv.id_reserva id FROM dbo.Reservas rv
    JOIN dbo.Opciones op ON op.id_opcion=rv.id_opcion JOIN dbo.Disponibilidad ds ON ds.id_disponibilidad=op.id_disponibilidad
    WHERE rv.estado NOT IN ('Cancelada','Vencida') AND ds.id_profesional=${d.id_profesional}
      AND ds.fecha=CONVERT(date,${d.fecha})
      AND ds.hora_inicio<CONVERT(time,${d.hora_fin.toISOString().slice(11,19)})
      AND ds.hora_fin>CONVERT(time,${d.hora_inicio.toISOString().slice(11,19)})`;
  if(overlap)throw new TransferError('El especialista ya tiene otra reserva que se superpone con este horario.');
  const previous=await tx.eventosEtapa.findFirst({where:{id_solicitud:r.id_solicitud,EtapaDestino:{nombre:'PAYER'}}});
  if(previous)throw new TransferError('Existe un traspaso anterior que requiere conciliación.');
}
export type TransferCommand={personId:number;requestId:number;optionId:number;fingerprint:string;key:string;
  accepted:boolean;authorized:boolean;contactConsent:boolean;source:'ASESOR'|'PACIENTE';evidence:string;actorId:number|null};

export async function executePayerTransfer(tx:Prisma.TransactionClient, command:TransferCommand) {
  const c=command;
  if(c.accepted!==true||c.authorized!==true)throw new TransferError('Confirma la aceptación comercial y la autorización expresa para reservar.',400);
  if(c.source==='PACIENTE'&&c.contactConsent!==true)throw new TransferError('Confirma expresamente el consentimiento de contacto.',400);
  if(typeof c.key!=='string'||typeof c.fingerprint!=='string'||typeof c.evidence!=='string'||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(c.key)||!/^[a-f0-9]{64}$/.test(c.fingerprint)||!c.evidence.trim()||c.evidence.length>300)
    throw new TransferError('Faltan la clave, las condiciones o la evidencia de confirmación.',400);
  await assertTransferSchema(tx);
  await transferLock(tx);
  const [old]=await tx.$queryRaw<{id_reserva:number;id_opcion:number;huella:string;id_persona:number;id_evento:number}[]>`
    SELECT id_reserva,id_opcion,huella,id_persona,id_evento FROM dbo.TraspasosPayerLead WHERE id_solicitud=${c.requestId}`;
  if(old) {
    if(old.id_persona!==c.personId||old.id_opcion!==c.optionId||old.huella!==c.fingerprint)
      throw new TransferError('La solicitud ya se traspasó con otras condiciones.');
    const reservation=await tx.reservas.findUnique({where:{id_reserva:old.id_reserva}});
    const event=await tx.eventosEtapa.findUnique({where:{id_evento_etapa:old.id_evento}});
    if(!reservation||reservation.id_persona!==c.personId||reservation.id_solicitud!==c.requestId||reservation.id_opcion!==c.optionId||
      !event||event.id_solicitud!==c.requestId||event.id_persona!==c.personId)
      throw new TransferError('El traspaso registrado tiene referencias inconsistentes. Requiere revisión.');
    if(['Cancelada','Vencida'].includes(reservation.estado))throw new TransferError('La reserva del traspaso está cancelada o vencida. No se creará otra automáticamente.');
    return {id_reserva:old.id_reserva,codigoReserva:`NEXO-${String(old.id_reserva).padStart(5,'0')}`,reutilizada:true};
  }
  const offer=await loadTransferOffer(tx,c.personId,c.requestId,c.optionId);
  if(offer.huella!==c.fingerprint)throw new TransferError('Las condiciones cambiaron. Actualiza la oferta y vuelve a confirmarla.');
  await checkTransferOffer(tx,offer);
  const {request:r,option:o,proposal:p,slot:d}=offer;
  if(c.actorId!=null) {
    const actor=await tx.usuarios.findUnique({where:{id_usuario:c.actorId},include:{Rol:true}});
    if(!actor?.activo||!['Administrador','Negociador'].includes(actor.Rol.nombre)||
      (actor.Rol.nombre!=='Administrador'&&r.id_negociador!==actor.id_usuario))throw new TransferError('No tienes autorización sobre esta negociación.',403);
  }
  const payer=await tx.etapas.findUnique({where:{nombre:'PAYER'}});
  const lead=await tx.etapas.findUnique({where:{nombre:'LEAD'}});
  if(!payer||!lead)throw new TransferError('No están configuradas las etapas LEAD y PAYER.');
  const occupied=await tx.disponibilidad.updateMany({where:{id_disponibilidad:d.id_disponibilidad,estado:'Disponible'},data:{estado:'Ocupado'}});
  if(occupied.count!==1)throw new TransferError('El horario fue ocupado por otra operación.');
  const now=new Date();
  // Record only the explicit confirmation submitted to this endpoint. Never infer it from a selected card.
  if(p.estado!=='Aceptada')await tx.propuestasEconomicasLead.update({where:{id_propuesta:p.id_propuesta},data:{estado:'Aceptada',fecha_decision:now,id_motivo_rechazo_lead:null}});
  await tx.opciones.updateMany({where:{id_solicitud:r.id_solicitud,seleccionada:true,id_opcion:{not:o.id_opcion}},data:{seleccionada:false}});
  await tx.opciones.update({where:{id_opcion:o.id_opcion},data:{seleccionada:true,estado_respuesta:'Aceptada',fecha_respuesta:o.fecha_respuesta??now,id_motivo_rechazo_lead:null}});
  await tx.solicitudes.update({where:{id_solicitud:r.id_solicitud},data:{estado:'Convertida',resultado_comercial_lead:'ACEPTADA',
    fecha_decision_comercial_lead:r.fecha_decision_comercial_lead??now,valor_acordado_lead:p.precio_cotizado,id_propuesta_aceptada_lead:p.id_propuesta,motivo_cierre_lead:null}});
  const moved=await tx.personas.updateMany({where:{id_persona:r.id_persona,id_etapa_actual:lead.id_etapa},
    data:{id_etapa_actual:payer.id_etapa,...(c.source==='PACIENTE'?{autoriza_contacto:true,fecha_autorizacion:now}:{})}});
  if(moved.count!==1)throw new TransferError('La persona cambió de etapa durante la confirmación.');
  const reservation=await tx.reservas.create({data:{id_persona:r.id_persona,id_solicitud:r.id_solicitud,id_opcion:o.id_opcion,
    estado:'Pendiente',confirmacion_explicita:true,fecha_confirmacion:now}});
  const event=await tx.eventosEtapa.create({data:{id_persona:r.id_persona,id_solicitud:r.id_solicitud,
    etapa_origen:lead.id_etapa,etapa_destino:payer.id_etapa,id_usuario:c.actorId,
    motivo:'Traspaso LEAD confirmado por '+c.source,evidencia:c.evidence}});
  await tx.$executeRaw`INSERT dbo.TraspasosPayerLead
    (id_solicitud,id_persona,id_opcion,id_propuesta,id_reserva,id_evento,clave_operacion,huella,origen,evidencia,id_usuario,autoriza_contacto)
    VALUES(${r.id_solicitud},${r.id_persona},${o.id_opcion},${p.id_propuesta},${reservation.id_reserva},${event.id_evento_etapa},
      ${c.key},${c.fingerprint},${c.source},${c.evidence},${c.actorId},${c.contactConsent})`;
  return {id_reserva:reservation.id_reserva,codigoReserva:`NEXO-${String(reservation.id_reserva).padStart(5,'0')}`,reutilizada:false};
}

export async function createPreReservationAccess(tx:Prisma.TransactionClient, person:number, request:number, option:number, actorId:number|null) {
  await assertTransferSchema(tx);
  const offer=await loadTransferOffer(tx,person,request,option);
  await checkTransferOffer(tx,offer);
  const token=randomBytes(32).toString('hex');
  // Access may not outlive the actual price expiry. No fixed clinic deadline is invented.
  const expiry=offer.proposal.fecha_vigencia_hasta_utc_lead!;
  await tx.$executeRaw`INSERT dbo.AccesosPreReservaLead(hash_token,id_persona,id_solicitud,id_opcion,huella,vence_utc,id_usuario)
    VALUES(${hashAccess(token)},${person},${request},${option},${offer.huella},${expiry},${actorId})`;
  return {token,huella:offer.huella,vence_utc:expiry};
}

export async function publicAccess(tx:Prisma.TransactionClient, person:number, token:unknown) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new TransferError('Enlace de pre-reserva inválido.',403);
  await assertTransferSchema(tx);
  const [access]=await tx.$queryRaw<{id_solicitud:number;id_opcion:number;huella:string;vence_utc:Date}[]>`
    SELECT id_solicitud,id_opcion,huella,vence_utc FROM dbo.AccesosPreReservaLead WHERE hash_token=${hashAccess(token)} AND id_persona=${person}`;
  if(!access)throw new TransferError('Enlace de pre-reserva inválido.',403);
  return access;
}

export const runPayerTransfer=(command:TransferCommand)=>prisma.$transaction(tx=>executePayerTransfer(tx,command),transferIsolation);
