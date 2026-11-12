import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { prisma } from '../src/db';
import { leadTransferRouter } from '../src/routes/leadTransfer.routes';
import { leadCommercialRouter } from '../src/routes/leadCommercial.routes';
import { hashLeadStaffPassword } from '../src/services/leadStaffAuth';

type Fixture={person:number;request:number;option:number;proposal:number;slot:number};
async function main() {
  const [target]=await prisma.$queryRaw<{db:string}[]>`SELECT DB_NAME() db`;
  assert.equal(target.db,'NexoSalud_LeadPruebas','Prohibido ejecutar los fallos sintéticos en la principal.');
  const original=prisma.$transaction.bind(prisma);
  const fixtures:Fixture[]=[],slots:number[]=[],proposalIds:number[]=[];
  let professional=0;
  let userId:number|undefined;
  let failAt='';
  const report:string[]=[];
  const app=express();app.use(express.json());app.use('/api/lead/commercial',leadCommercialRouter);app.use('/api/lead',leadTransferRouter);
  let server=app.listen(0,'127.0.0.1');await once(server,'listening');
  let base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/lead';
  const roleMode=process.env.LEAD_STAFF_AUTH_ENABLED,qaMode=process.env.LEAD_STAFF_AUTH_QA;
  process.env.LEAD_STAFF_AUTH_ENABLED='false';process.env.LEAD_STAFF_AUTH_QA='false';
  const spids=new Set<number>();
  const before=await prisma.$queryRaw`SELECT (SELECT COUNT_BIG(*) FROM dbo.Pagos) pagos,(SELECT COUNT_BIG(*) FROM dbo.Reservas) reservas,(SELECT COUNT_BIG(*) FROM dbo.Personas) personas`;
  async function fixture(sharedSlot?:number,config:{past?:boolean;expiryMs?:number;unknownExpiry?:boolean}={}):Promise<Fixture> {
    return original(async tx=>{
      const stage=await tx.etapas.findUniqueOrThrow({where:{nombre:'LEAD'}});
      const service=await tx.servicios.findFirstOrThrow({where:{activo:true}});
      const site=await tx.sedes.findFirstOrThrow({where:{activo:true}});
      if(!professional) {
        professional=(await tx.profesionales.create({data:{nombres:'CAP05 temporal',apellidos:randomUUID()}})).id_profesional;
        await tx.profesionalServicio.create({data:{id_profesional:professional,id_servicio:service.id_servicio}});
      }
      const slot=sharedSlot??(await tx.disponibilidad.create({data:{id_profesional:professional,id_sede:site.id_sede,
        fecha:new Date(config.past?'2000-01-01T00:00:00Z':'2099-08-'+String(slots.length+1).padStart(2,'0')+'T00:00:00Z'),hora_inicio:new Date('1970-01-01T09:00:00Z'),hora_fin:new Date('1970-01-01T10:00:00Z')}})).id_disponibilidad;
      if(!sharedSlot)slots.push(slot);
      const person=await tx.personas.create({data:{nombres:'CAP05 temporal',apellidos:randomUUID(),id_etapa_actual:stage.id_etapa}});
      const request=await tx.solicitudes.create({data:{id_persona:person.id_persona,id_servicio:service.id_servicio,fecha_ingreso_lead:new Date(),resultado_comercial_lead:'PENDIENTE'}});
      const proposal=await tx.propuestasEconomicasLead.create({data:{id_solicitud:request.id_solicitud,id_servicio:service.id_servicio,
        precio_cotizado:'125.50',fecha_vigencia_hasta_utc_lead:config.unknownExpiry?null:new Date(Date.now()+(config.expiryMs??86400000))}});
      proposalIds.push(proposal.id_propuesta);
      const option=await tx.opciones.create({data:{id_solicitud:request.id_solicitud,id_disponibilidad:slot,id_propuesta_lead:proposal.id_propuesta,precio_ofrecido:'125.50',estado_respuesta:'Pendiente'}});
      const result={person:person.id_persona,request:request.id_solicitud,proposal:proposal.id_propuesta,option:option.id_opcion,slot};fixtures.push(result);return result;
    });
  }
  async function request(path:string,body?:object) {
    const response=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
    return {status:response.status,body:await response.json()};
  }
  async function preview(f:Fixture) {const r=await request(`/${f.person}/transfer-preview?id_solicitud=${f.request}&id_opcion=${f.option}`);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
  function payload(f:Fixture,p:any) {return {id_solicitud:f.request,id_opcion:f.option,huella:p.huella,clave_operacion:randomUUID(),aceptacion_explicita:true,autorizacion_reserva:true,evidencia:'Confirmación temporal CAP05'};}
  async function counts(f:Fixture) {
    return {reservas:await prisma.reservas.count({where:{id_solicitud:f.request}}),eventos:await prisma.eventosEtapa.count({where:{id_solicitud:f.request,EtapaDestino:{nombre:'PAYER'}}}),
      pagos:await prisma.pagos.count({where:{Reserva:{id_solicitud:f.request}}})};
  }
  async function ok(name:string,work:()=>Promise<void>) {await work();report.push(name);console.log('OK · '+name);}
  try {
    // Keep real transactions and separate SQL connections; inject errors only inside the test process.
    prisma.$transaction=(async(action:any,options:any)=>original(async tx=>{
      const [connection]=await tx.$queryRaw<{id:number}[]>`SELECT @@SPID id`;spids.add(connection.id);
      const proxy=new Proxy(tx,{get(target,property){
        const obj=Reflect.get(target,property);
        if(property==='reservas'||property==='eventosEtapa')return new Proxy(obj,{get(model,key){
          if(key==='create')return async(args:any)=>{const value=await model.create(args);if(failAt===property)throw new Error('CAP05 injected failure');return value;};
          return Reflect.get(model,key);
        }});
        if(property==='disponibilidad')return new Proxy(obj,{get(model,key){if(key==='updateMany')return async(args:any)=>{const value=await model.updateMany(args);if(failAt==='slot')throw new Error('CAP05 injected failure');return value;};return Reflect.get(model,key);}});
        if(property==='$executeRaw')return async(...args:any[])=>{const value=await (target.$executeRaw as any)(...args);if(failAt==='receipt'&&String(args[0]).includes('INSERT dbo.TraspasosPayerLead'))throw new Error('CAP05 injected failure');return value;};
        return obj;
      }});
      return action(proxy);
    },options)) as typeof prisma.$transaction;
    const f=await fixture(),p=await preview(f),body=payload(f,p);
    await ok('sin aceptación o autorización no se escribe nada',async()=>{
      assert.equal((await request(`/${f.person}/reserve`,{...body,aceptacion_explicita:false})).status,400);
      assert.equal((await request(`/${f.person}/reserve`,{...body,autorizacion_reserva:false})).status,400);
      assert.deepEqual(await counts(f),{reservas:0,eventos:0,pagos:0});
    });
    await ok('identificadores y huella manipulados se rechazan',async()=>{
      assert.equal((await request(`/${f.person}/reserve`,{...body,huella:'0'.repeat(64)})).status,409);
      assert.equal((await request(`/${f.person}/reserve`,{...body,id_opcion:2147483647})).status,409);
      assert.equal((await request(`/${f.person}/reserve`,{...body,id_solicitud:2147483647})).status,404);
    });
    await ok('sesión habilitada exige autenticación real',async()=>{
      process.env.LEAD_STAFF_AUTH_ENABLED='true';assert.equal((await request(`/${f.person}/reserve`,body)).status,401);process.env.LEAD_STAFF_AUTH_ENABLED='false';
    });
    for(const point of ['slot','reservas','eventosEtapa','receipt'])await ok('rollback completo ante fallo en '+point,async()=>{
      failAt=point;assert.equal((await request(`/${f.person}/reserve`,body)).status,500);failAt='';
      assert.deepEqual(await counts(f),{reservas:0,eventos:0,pagos:0});
      assert.equal((await prisma.disponibilidad.findUniqueOrThrow({where:{id_disponibilidad:f.slot}})).estado,'Disponible');
      assert.equal((await prisma.personas.findUniqueOrThrow({where:{id_persona:f.person},include:{Etapa:true}})).Etapa.nombre,'LEAD');
      assert.equal((await prisma.solicitudes.findUniqueOrThrow({where:{id_solicitud:f.request}})).resultado_comercial_lead,'PENDIENTE');
    });
    await ok('doble confirmación simultánea devuelve una reserva y un evento',async()=>{
      const responses=await Promise.all([request(`/${f.person}/reserve`,body),request(`/${f.person}/reserve`,body)]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);
      assert.equal(responses[0].body.data.reservaId,responses[1].body.data.reservaId);
      assert.deepEqual(await counts(f),{reservas:1,eventos:1,pagos:0});
    });
    await ok('recuperación tras perder respuesta y reiniciar servidor HTTP',async()=>{
      await new Promise<void>(resolve=>server.close(()=>resolve()));
      server=app.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/lead';
      const recovered=await request(`/${f.person}/reserve`,body);assert.equal(recovered.status,200);assert.equal(recovered.body.data.reutilizada,true);
      assert.deepEqual(await counts(f),{reservas:1,eventos:1,pagos:0});
    });
    const a=await fixture(),b=await fixture(a.slot),pa=await preview(a),pb=await preview(b);
    await ok('dos solicitudes compiten por un horario: solo una gana',async()=>{
      const results=await Promise.all([request(`/${a.person}/reserve`,payload(a,pa)),request(`/${b.person}/reserve`,payload(b,pb))]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await counts(a)).reservas+(await counts(b)).reservas,1);
    });
    const pub=await fixture();
    const grant=await request(`/${pub.person}/pre-reservation-access`,{id_solicitud:pub.request,id_opcion:pub.option});assert.equal(grant.status,200,JSON.stringify(grant.body));
    const token=grant.body.token;
    const publicOffer=await request(`/public/${pub.person}?token=${token}`);assert.equal(publicOffer.status,200,JSON.stringify(publicOffer.body));
    const po=publicOffer.body;
    const publicBody={...payload(pub,po),token,consentimiento_contacto:true,dni:'87654321',
      fecha:po.fechaOfrecida,hora:po.horaSugerida,id_sede:po.sedeId,id_servicio_seleccionado:po.id_servicio,
      dudaOComentario:'Caso temporal',canal_pago:'En clínica'};
    await ok('enlace privado requerido; no hay lectura por ID ni token de otra persona',async()=>{
      assert.equal((await request(`/public/${pub.person}`)).status,403);
      assert.equal((await request(`/public/${f.person}?token=${token}`)).status,403);
    });
    await ok('consentimiento público explícito validado en backend',async()=>{
      assert.equal((await request(`/public/${pub.person}/pre-reserve`,{...publicBody,consentimiento_contacto:false})).status,400);
      assert.deepEqual(await counts(pub),{reservas:0,eventos:0,pagos:0});
    });
    await ok('fecha sede servicio o turno manipulados no cambian la alternativa',async()=>{
      for(const change of [{fecha:'2099-01-01'},{hora:'18:00 - 19:00'},{id_sede:2147483647},{id_servicio_seleccionado:2147483647}])
        assert.equal((await request(`/public/${pub.person}/pre-reserve`,{...publicBody,...change})).status,409);
    });
    await ok('carrera entre Pre-Reserva y Cerrar Trato recupera el mismo resultado',async()=>{
      const results=await Promise.all([request(`/public/${pub.person}/pre-reserve`,{...publicBody,selectedServicePrice:0.01}),request(`/${pub.person}/reserve`,payload(pub,po))]);
      assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].body.data.reservaId,results[1].body.data.reservaId);
      assert.deepEqual(await counts(pub),{reservas:1,eventos:1,pagos:0});
      assert.equal((await prisma.opciones.findUniqueOrThrow({where:{id_opcion:pub.option}})).precio_ofrecido.toFixed(2),'125.50');
      const recovery=await request(`/public/${pub.person}?token=${token}`);assert.equal(recovery.status,200);assert.ok(recovery.body.resultado.reservaId);
    });
    const standalone=await fixture(),g=await request(`/${standalone.person}/pre-reservation-access`,{id_solicitud:standalone.request,id_opcion:standalone.option});
    const publicData=(await request(`/public/${standalone.person}?token=${g.body.token}`)).body;
    await ok('recorrido público completo persiste confirmación y contacto sin pagos',async()=>{
      const data={...payload(standalone,publicData),token:g.body.token,consentimiento_contacto:true,dni:'87654322',fecha:publicData.fechaOfrecida,hora:publicData.horaSugerida,
        id_sede:publicData.sedeId,id_servicio_seleccionado:publicData.id_servicio,nivelDolor:'Leve',alergias:'Ninguna'};
      const first=await request(`/public/${standalone.person}/pre-reserve`,data);assert.equal(first.status,201,JSON.stringify(first.body));
      assert.equal((await request(`/public/${standalone.person}/pre-reserve`,data)).status,200);
      assert.deepEqual(await counts(standalone),{reservas:1,eventos:1,pagos:0});
      assert.equal(await prisma.interacciones.count({where:{id_solicitud:standalone.request,tipo:'Portal Web Pre-Reserva'}}),1);
    });
    const replaced=await fixture(),replacedPreview=await preview(replaced);
    await prisma.propuestasEconomicasLead.create({data:{id_solicitud:replaced.request,id_servicio:po.id_servicio,id_propuesta_raiz:replaced.proposal,
      numero_version:2,precio_cotizado:'126',fecha_vigencia_hasta_utc_lead:new Date(Date.now()+86400000)}}).then(p=>proposalIds.push(p.id_propuesta));
    await ok('propuesta sustituida bloquea confirmación antigua',async()=>{assert.equal((await request(`/${replaced.person}/reserve`,payload(replaced,replacedPreview))).status,409);});
    const inactive=await fixture(),ip=await preview(inactive);
    await prisma.profesionales.update({where:{id_profesional:professional},data:{activo:false}});
    await ok('especialista inactivo bloquea reserva',async()=>{assert.equal((await request(`/${inactive.person}/reserve`,payload(inactive,ip))).status,409);});
    await prisma.profesionales.update({where:{id_profesional:professional},data:{activo:true}});
    await ok('horario pasado no se puede confirmar',async()=>{
      const past=await fixture(undefined,{past:true});assert.equal((await request(`/${past.person}/transfer-preview?id_solicitud=${past.request}&id_opcion=${past.option}`)).status,409);
    });
    await ok('vigencia desconocida no se interpreta como ilimitada',async()=>{
      const unknown=await fixture(undefined,{unknownExpiry:true});assert.equal((await request(`/${unknown.person}/transfer-preview?id_solicitud=${unknown.request}&id_opcion=${unknown.option}`)).status,409);
    });
    await ok('vencimiento entre vista y confirmación se revalida',async()=>{
      const expires=await fixture(undefined,{expiryMs:1800}),ep=await preview(expires);
      await new Promise(resolve=>setTimeout(resolve,1900));
      assert.equal((await request(`/${expires.person}/reserve`,payload(expires,ep))).status,409);assert.deepEqual(await counts(expires),{reservas:0,eventos:0,pagos:0});
    });
    await ok('solicitud cerrada y alternativa archivada bloquean el traspaso',async()=>{
      const closed=await fixture(),cp=await preview(closed);
      await prisma.solicitudes.update({where:{id_solicitud:closed.request},data:{resultado_comercial_lead:'CERRADA_SIN_ACUERDO',fecha_decision_comercial_lead:new Date(),motivo_cierre_lead:'Cierre temporal CAP05'}});
      assert.equal((await request(`/${closed.person}/reserve`,payload(closed,cp))).status,409);
      const archived=await fixture(),ap=await preview(archived);
      await prisma.opciones.update({where:{id_opcion:archived.option},data:{archivada_lead_en:new Date()}});
      assert.equal((await request(`/${archived.person}/reserve`,payload(archived,ap))).status,409);
    });
    await ok('reserva heredada sin comprobante no se duplica ni se acredita artificialmente',async()=>{
      const legacy=await fixture(),lp=await preview(legacy);
      await prisma.reservas.create({data:{id_persona:legacy.person,id_solicitud:legacy.request,id_opcion:legacy.option}});
      assert.equal((await request(`/${legacy.person}/reserve`,payload(legacy,lp))).status,409);assert.equal((await counts(legacy)).reservas,1);assert.equal((await counts(legacy)).eventos,0);
    });
    await ok('M1 M3 y M6 reflejan aceptación una sola vez tras reintentos',async()=>{
      const [measures]=await prisma.$queryRaw<{m1:number;m3:number;m6:number}[]>`SELECT
        (SELECT SUM(oportunidad_aceptada) FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME()) WHERE id_solicitud=${f.request}) m1,
        (SELECT SUM(propuesta_aceptada) FROM dbo.fn_Lead_Propuestas_Corte(SYSUTCDATETIME()) WHERE id_solicitud=${f.request}) m3,
        (SELECT SUM(alternativa_aceptada) FROM dbo.fn_Lead_Alternativas_Corte(SYSUTCDATETIME()) WHERE id_solicitud=${f.request}) m6`;
      assert.deepEqual(measures,{m1:1,m3:1,m6:1});
    });
    await ok('entrada autenticada existente delega en el mismo servicio y recupera el resultado',async()=>{
      const authenticated=await fixture();
      const role=await prisma.roles.findFirstOrThrow({where:{nombre:'Negociador'}});
      const email=randomUUID()+'@example.invalid',password=randomUUID();
      userId=(await prisma.usuarios.create({data:{nombres:'CAP05',apellidos:'Temporal',email,password_hash:await hashLeadStaffPassword(password),id_rol:role.id_rol}})).id_usuario;
      await prisma.solicitudes.update({where:{id_solicitud:authenticated.request},data:{id_negociador:userId}});
      await prisma.propuestasEconomicasLead.update({where:{id_propuesta:authenticated.proposal},data:{estado:'Aceptada',fecha_decision:new Date()}});
      await prisma.opciones.update({where:{id_opcion:authenticated.option},data:{estado_respuesta:'Aceptada',fecha_respuesta:new Date(),seleccionada:true}});
      await prisma.solicitudes.update({where:{id_solicitud:authenticated.request},data:{resultado_comercial_lead:'ACEPTADA',fecha_decision_comercial_lead:new Date(),valor_acordado_lead:'125.50',id_propuesta_aceptada_lead:authenticated.proposal}});
      process.env.LEAD_STAFF_AUTH_ENABLED='true';
      const login=await request('/commercial/staff/session',{email,password});assert.equal(login.status,200,JSON.stringify(login.body));
      const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.body.token};
      const path='/commercial/opportunities/'+authenticated.request;
      const readiness=await fetch(base+path+'/payer-readiness',{headers}).then(r=>r.json());
      assert.ok(readiness.condiciones_autorizables,JSON.stringify(readiness));
      const conditions=readiness.condiciones_autorizables;
      const channel=await prisma.canales.findFirstOrThrow({where:{activo:true}});
      const authorization=await fetch(base+path+'/staff/reservation-authorization',{method:'POST',headers,body:JSON.stringify({confirmada:true,id_canal:channel.id_canal,referencia_evidencia:'CAP05 temporal',...conditions})}).then(async r=>({status:r.status,body:await r.json()}));
      assert.equal(authorization.status,200,JSON.stringify(authorization.body));
      const confirm=()=>fetch(base+path+'/staff/payer-transfer',{method:'POST',headers,body:JSON.stringify({confirmado:true,id_autorizacion:authorization.body.id_autorizacion})}).then(async r=>({status:r.status,body:await r.json()}));
      const first=await confirm();assert.equal(first.status,201,JSON.stringify(first.body));
      assert.equal((await confirm()).status,200);assert.deepEqual(await counts(authenticated),{reservas:1,eventos:1,pagos:0});
      process.env.LEAD_STAFF_AUTH_ENABLED='false';
    });
    assert.ok(spids.size>=2,'La concurrencia debe usar conexiones SQL independientes.');
    report.push(`Conexiones SQL independientes observadas: ${spids.size}`);
  } finally {
    prisma.$transaction=original as typeof prisma.$transaction;
    if(roleMode===undefined)delete process.env.LEAD_STAFF_AUTH_ENABLED;else process.env.LEAD_STAFF_AUTH_ENABLED=roleMode;
    if(qaMode===undefined)delete process.env.LEAD_STAFF_AUTH_QA;else process.env.LEAD_STAFF_AUTH_QA=qaMode;
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    // Delete only IDs created by this script, in FK order, including audited test history.
    const requests=fixtures.map(f=>f.request),people=fixtures.map(f=>f.person),options=fixtures.map(f=>f.option);
    await original(async tx=>{
      for(const id of requests){await tx.$executeRaw`DELETE dbo.AutorizacionesReservaLead WHERE id_solicitud=${id}`;await tx.$executeRaw`DELETE dbo.TraspasosPayerLead WHERE id_solicitud=${id}`;await tx.$executeRaw`DELETE dbo.AccesosPreReservaLead WHERE id_solicitud=${id}`;}
      await tx.interacciones.deleteMany({where:{id_solicitud:{in:requests}}});
      await tx.eventosEtapa.deleteMany({where:{id_solicitud:{in:requests}}});
      await tx.reservas.deleteMany({where:{id_solicitud:{in:requests}}});
      await tx.solicitudes.updateMany({where:{id_solicitud:{in:requests}},data:{resultado_comercial_lead:'PENDIENTE',fecha_decision_comercial_lead:null,valor_acordado_lead:null,id_propuesta_aceptada_lead:null}});
      await tx.opciones.deleteMany({where:{id_opcion:{in:options}}});
      // Versions first, then roots.
      await tx.propuestasEconomicasLead.deleteMany({where:{id_solicitud:{in:requests},id_propuesta_raiz:{not:null}}});
      await tx.propuestasEconomicasLead.deleteMany({where:{id_solicitud:{in:requests}}});
      await tx.solicitudes.deleteMany({where:{id_solicitud:{in:requests}}});
      await tx.personaSaludOdontologica.deleteMany({where:{id_persona:{in:people}}});
      await tx.personas.deleteMany({where:{id_persona:{in:people}}});
      if(userId)await tx.usuarios.delete({where:{id_usuario:userId}});
      await tx.disponibilidad.deleteMany({where:{id_disponibilidad:{in:slots}}});
      if(professional){await tx.profesionalServicio.deleteMany({where:{id_profesional:professional}});await tx.profesionales.delete({where:{id_profesional:professional}});}
      for(const id of requests){
        await tx.$executeRaw`DELETE dbo.HistorialSolicitudesLead WHERE id_solicitud=${id}`;
        await tx.$executeRaw`DELETE dbo.HistorialPropuestasLead WHERE id_solicitud=${id}`;
        await tx.$executeRaw`DELETE dbo.HistorialOpcionesLead WHERE id_solicitud=${id}`;
      }
      for(const id of proposalIds)await tx.$executeRaw`DELETE dbo.HistorialVigenciaPropuestasLead WHERE id_propuesta=${id}`;
      for(const id of options)await tx.$executeRaw`DELETE dbo.CambiosOpcionLead WHERE id_opcion=${id}`;
    },{timeout:30000});
    const after=await prisma.$queryRaw`SELECT (SELECT COUNT_BIG(*) FROM dbo.Pagos) pagos,(SELECT COUNT_BIG(*) FROM dbo.Reservas) reservas,(SELECT COUNT_BIG(*) FROM dbo.Personas) personas`;
    assert.deepEqual(after,before);console.log('OK · limpieza por IDs y conservación de conteos previos');
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({suite:'CAP-05',database:'NexoSalud_LeadPruebas',passed:report.length-1,checks:report},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
