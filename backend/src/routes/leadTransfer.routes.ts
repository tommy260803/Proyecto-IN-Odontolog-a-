import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { getLeadStaffIdentity, leadStaffAuthEnabled } from '../services/leadStaffAuth';
import { assertTransferSchema, checkTransferOffer, createPreReservationAccess, executePayerTransfer,
  loadTransferOffer, publicAccess, TransferError, transferId, transferIsolation, transferLock } from '../services/leadPayerTransfer';

export const leadTransferRouter=Router();
const handler=(fn:(req:Request,res:Response)=>Promise<unknown>)=>async(req:Request,res:Response)=>{
  res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');
  try { await fn(req,res); } catch(error) {
    if(error instanceof TransferError)return res.status(error.status).json({error:error.message});
    if(error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034','P2028'].includes(error.code))
      return res.status(409).json({error:'Otra operación cambió el expediente. Reintenta la misma confirmación.'});
    return res.status(500).json({error:'No se pudo confirmar el traspaso. No cambies la selección: reintenta para recuperar el resultado.'});
  }
};
async function staff(req:Request,tx:Prisma.TransactionClient,person:number,request:number) {
  const row=await tx.solicitudes.findFirst({where:{id_solicitud:request,id_persona:person}});
  if(!row)throw new TransferError('Solicitud inexistente.',404);
  const user=await getLeadStaffIdentity(req,tx);
  if(leadStaffAuthEnabled()&&!user)throw new TransferError('Se requiere sesión del personal.',401);
  if(user&&user.rol!=='Administrador'&&row.id_negociador!==user.id_usuario)throw new TransferError('No tienes acceso a esta negociación.',403);
  // Existing local workspace supports a sessionless advisor mode. Never invent a user identity.
  return user?.id_usuario??null;
}
leadTransferRouter.get('/:id/transfer-preview',handler(async(req,res)=>{
  const person=transferId(req.params.id),request=transferId(req.query.id_solicitud),option=transferId(req.query.id_opcion);
  const offer=await prisma.$transaction(async tx=>{
    await assertTransferSchema(tx);await staff(req,tx,person,request);
    const offer=await loadTransferOffer(tx,person,request,option);await checkTransferOffer(tx,offer);return offer;
  },transferIsolation);
  res.json({huella:offer.huella,id_solicitud:request,id_opcion:option,id_propuesta:offer.proposal.id_propuesta,
    precio:offer.proposal.precio_cotizado.toFixed(2),servicio:offer.request.Servicio?.nombre,
    sede:offer.slot.Sede.nombre,profesional:offer.slot.Profesional.nombres+' '+offer.slot.Profesional.apellidos,
    fecha:offer.slot.fecha.toISOString().slice(0,10),inicio:offer.slot.hora_inicio.toISOString().slice(11,16),
    fin:offer.slot.hora_fin.toISOString().slice(11,16),vence:offer.proposal.fecha_vigencia_hasta_utc_lead});
}));
leadTransferRouter.post('/:id/pre-reservation-access',handler(async(req,res)=>{
  const person=transferId(req.params.id),request=transferId(req.body.id_solicitud),option=transferId(req.body.id_opcion);
  const result=await prisma.$transaction(async tx=>{
    const actor=await staff(req,tx,person,request);return createPreReservationAccess(tx,person,request,option,actor);
  },transferIsolation);
  res.json(result);
}));
leadTransferRouter.post('/:id/reserve',handler(async(req,res)=>{
  const person=transferId(req.params.id),request=transferId(req.body.id_solicitud),option=transferId(req.body.id_opcion);
  const result=await prisma.$transaction(async tx=>{
    await transferLock(tx);
    const actor=await staff(req,tx,person,request);
    return executePayerTransfer(tx,{personId:person,requestId:request,optionId:option,
      fingerprint:req.body.huella??'',key:req.body.clave_operacion??'',accepted:req.body.aceptacion_explicita,
      authorized:req.body.autorizacion_reserva,contactConsent:false,source:'ASESOR',actorId:actor,
      evidence:typeof req.body.evidencia==='string'?req.body.evidencia:''});
  },transferIsolation);
  res.status(result.reutilizada?200:201).json({message:'Reserva pendiente registrada. Traspaso a PAYER confirmado.',data:{...result,reservaId:result.id_reserva}});
}));
leadTransferRouter.get('/public/:id',handler(async(req,res)=>{
  const person=transferId(req.params.id);
  const result=await prisma.$transaction(async tx=>{
    const access=await publicAccess(tx,person,req.query.token);
    const [receipt]=await tx.$queryRaw<{id_reserva:number;huella:string}[]>`SELECT id_reserva,huella FROM dbo.TraspasosPayerLead WHERE id_solicitud=${access.id_solicitud}`;
    if(access.vence_utc<=new Date()&&!receipt)throw new TransferError('El enlace venció. Solicita una propuesta actualizada.');
    const offer=await loadTransferOffer(tx,person,access.id_solicitud,access.id_opcion);
    if(offer.huella!==access.huella||receipt&&receipt.huella!==access.huella)throw new TransferError('La oferta cambió. Solicita un nuevo enlace.');
    if(!receipt)await checkTransferOffer(tx,offer);
    const {request:r,proposal:p,slot:d,option:o}=offer;
    const health=await tx.personaSaludOdontologica.findFirst({where:{id_persona:person},orderBy:{id_salud_odonto:'desc'}});
    return {id_persona:person,patientName:r.Persona.nombres+' '+r.Persona.apellidos,firstName:r.Persona.nombres,lastName:r.Persona.apellidos,
      dni:r.Persona.dni??'',phone:r.Persona.numero??'',email:r.Persona.email??'',id_servicio:r.id_servicio,serviceName:r.Servicio?.nombre,
      serviceDescription:r.Servicio?.descripcion??'',originalPrice:Number(p.precio_cotizado),offeredPrice:Number(p.precio_cotizado),discountPct:0,
      relatedServices:[],catalogServices:[],expirationDate:p.fecha_vigencia_hasta_utc_lead?.toISOString(),
      sede:d.Sede.nombre,sedeId:d.id_sede,doctor:d.Profesional.nombres+' '+d.Profesional.apellidos,
      id_solicitud:r.id_solicitud,id_opcion:o.id_opcion,id_disponibilidad:d.id_disponibilidad,
      fechaOfrecida:d.fecha.toISOString().slice(0,10),horaSugerida:d.hora_inicio.toISOString().slice(11,16)+' - '+d.hora_fin.toISOString().slice(11,16),
      huella:offer.huella,sedes:[d.Sede],nivelDolor:health?.nivel_dolor??'No especificado',alergias:health?.condicion_atencion_especial??'',
      resultado:receipt?{reservaId:receipt.id_reserva,codigoReserva:`NEXO-${String(receipt.id_reserva).padStart(5,'0')}`,reutilizada:true}:null};
  },transferIsolation);
  res.json(result);
}));
leadTransferRouter.post('/public/:id/pre-reserve',handler(async(req,res)=>{
  const person=transferId(req.params.id);
  if(typeof req.body.dni!=='string'||!/^\d{8}$/.test(req.body.dni))throw new TransferError('Indica un DNI de ocho dígitos.',400);
  const fields:{[key:string]:number}={nombres:50,apellidos:50,numero:20,email:100,nivelDolor:20,alergias:100,canal_pago:50,dudaOComentario:500,nombreFamiliar:100,parentesco:50};
  for(const [name,max] of Object.entries(fields))if(req.body[name]!=null&&(typeof req.body[name]!=='string'||req.body[name].length>max))
    throw new TransferError('Revisa la longitud y formato de los datos de contacto.',400);
  const result=await prisma.$transaction(async tx=>{
    await transferLock(tx);
    const access=await publicAccess(tx,person,req.body.token);
    if(transferId(req.body.id_solicitud)!==access.id_solicitud||transferId(req.body.id_opcion)!==access.id_opcion||req.body.huella!==access.huella)
      throw new TransferError('La confirmación no corresponde a las condiciones de este enlace.');
    const [receipt]=await tx.$queryRaw<{id_solicitud:number}[]>`SELECT id_solicitud FROM dbo.TraspasosPayerLead WHERE id_solicitud=${access.id_solicitud}`;
    if(access.vence_utc<=new Date()&&!receipt)throw new TransferError('El enlace venció. Solicita una propuesta actualizada.');
    const offer=await loadTransferOffer(tx,person,access.id_solicitud,access.id_opcion);
    // Public edits cannot change the offered appointment or its service, even with a valid link.
    const day=offer.slot.fecha.toISOString().slice(0,10),time=offer.slot.hora_inicio.toISOString().slice(11,16)+' - '+offer.slot.hora_fin.toISOString().slice(11,16);
    if(req.body.fecha!==day||req.body.hora!==time||Number(req.body.id_sede)!==offer.slot.id_sede||Number(req.body.id_servicio_seleccionado)!==offer.proposal.id_servicio)
      throw new TransferError('Solo puedes confirmar el servicio, sede y horario ofrecidos. Para cambios, contacta al negociador.');
    const saved=await executePayerTransfer(tx,{personId:person,requestId:access.id_solicitud,optionId:access.id_opcion,
      fingerprint:access.huella,key:req.body.clave_operacion??'',accepted:req.body.aceptacion_explicita,authorized:req.body.autorizacion_reserva,
      contactConsent:req.body.consentimiento_contacto,source:'PACIENTE',actorId:null,evidence:'Confirmación expresa en enlace privado de Pre-Reserva'});
    if(!saved.reutilizada) {
      await tx.personas.update({where:{id_persona:person},data:{dni:req.body.dni,
        nombres:req.body.nombres?.trim()||undefined,apellidos:req.body.apellidos?.trim()||undefined,
        numero:req.body.numero?.trim()||undefined,email:req.body.email?.trim()||undefined}});
      if(req.body.nivelDolor||req.body.alergias) {
        const health=await tx.personaSaludOdontologica.findFirst({where:{id_persona:person},orderBy:{id_salud_odonto:'desc'}});
        const data={nivel_dolor:req.body.nivelDolor||health?.nivel_dolor||'No especificado',
          condicion_atencion_especial:req.body.alergias||health?.condicion_atencion_especial||null};
        if(health)await tx.personaSaludOdontologica.update({where:{id_salud_odonto:health.id_salud_odonto},data});
        else await tx.personaSaludOdontologica.create({data:{id_persona:person,...data}});
      }
      await tx.interacciones.create({data:{id_persona:person,id_solicitud:access.id_solicitud,tipo:'Portal Web Pre-Reserva',
        mensaje:('Confirmación expresa de la propuesta y autorización de reserva. '+
          (req.body.esParaFamiliar===true?`Atención para familiar: ${req.body.nombreFamiliar??''} (${req.body.parentesco??''}). `:'')+
          `Preferencia de pago declarada, sin pago generado: ${req.body.canal_pago??'No especificada'}. `+
          (req.body.dudaOComentario??'')).slice(0,1800),es_respuesta_util:true,resultado:'Reserva pendiente vinculada a PAYER'}});
    }
    return {...saved,reservaId:saved.id_reserva};
  },transferIsolation);
  res.status(result.reutilizada?200:201).json({success:true,message:'Reserva pendiente confirmada y vinculada a PAYER. No acredita un pago.',data:result});
}));
