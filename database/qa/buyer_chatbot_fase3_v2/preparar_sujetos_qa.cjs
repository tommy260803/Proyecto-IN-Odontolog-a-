// Fixtures mínimos, sintéticos, sin inicializadores ni alteración de contactos anteriores.
const fs=require('node:fs'),path=require('node:path');
const req=require('node:module').createRequire(path.resolve(__dirname,'../../../backend/package.json'));
const result={at:new Date().toISOString(),purpose:'QA_CHAT_F3V2_20261112',subjects:[]};let db;
(async()=>{
 if(process.env.QA_CREATE_BUYER_CHAT_SUBJECTS!=='true')throw Error('QA_OPT_IN_REQUIRED');
 req('dotenv').config({path:path.resolve(__dirname,'../../../backend/.env'),quiet:true});
 const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';
 if(process.env.RUN_SQL_TESTS!=='false'||!require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs').configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
 db=new(req('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]});
 const [target]=await db.$queryRaw`SELECT @@SERVERNAME servidor,DB_NAME() base`;
 if(target.servidor!=='DANIELPC'||target.base!=='NexoSalud_LeadEnsayoFinal')throw Error('QA_EFFECTIVE_TARGET_REJECTED');result.target=target;
 result.subjects=await db.$transaction(async tx=>{
  const [lock]=await tx.$queryRaw`DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='QA_CHAT_F3V2_20261112_FIXTURES',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=4000; SELECT @r result`;
  if(lock.result<0)throw Error('QA_FIXTURE_LOCK_FAILED');
  const stage=await tx.etapas.findUnique({where:{nombre:'BUYER'}});
  const service=await tx.servicios.findFirst({where:{id_servicio:1,activo:true}});
  if(!stage||!service)throw Error('QA_EXISTING_CATALOG_REQUIRED');
  const subjects=[];
  for(const purpose of ['DIRECTA','MANUAL']){
   const name=`QA_CHAT_F3V2_${purpose}_20261112`,surname='SINTETICO_FASE3_V2';
   let people=await tx.personas.findMany({where:{nombres:name,apellidos:surname}});
   if(people.length>1)throw Error('QA_DUPLICATE_FIXTURE');
   const created=people.length===0;
   if(created){
    const email=name.toLowerCase()+'@example.invalid';
    const rows=await tx.$queryRaw`INSERT dbo.Personas(nombres,apellidos,email,id_etapa_actual,autoriza_contacto,fecha_autorizacion,estado_calidad,fecha_registro)
      OUTPUT INSERTED.id_persona VALUES(${name},${surname},${email},${stage.id_etapa},1,SYSDATETIME(),'Valido',SYSDATETIME())`;
    const personId=rows[0].id_persona;
    await tx.$executeRaw`INSERT dbo.CaptacionesBuyer(id_persona,fecha_captacion,id_servicio,motivo_consulta,estado_calidad,autoriza_contacto,fecha_autorizacion,origen_datos,fecha_observacion)
      VALUES(${personId},SYSDATETIME(),1,'Sujeto sintético QA chatbot fase 3 v2; sin solicitud inicial','Valido',1,SYSDATETIME(),'REGISTRO_DIRECTO',SYSDATETIME())`;
    people=await tx.personas.findMany({where:{id_persona:personId}});
   }
   const [capture]=await tx.$queryRaw`SELECT id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=${people[0].id_persona}`;
   if(!capture)throw Error('QA_EXISTING_FIXTURE_CAPTURE_MISSING');
   subjects.push({purpose,created,id_persona:people[0].id_persona,id_captacion:capture.id_captacion});
  }return subjects;
 });
})().catch(e=>{result.error=/^QA_[A-Z_]+$/.test(e?.message||'')?e.message:'QA_FIXTURE_FAILED';process.exitCode=1;})
 .finally(async()=>{if(db)await db.$disconnect();fs.writeFileSync(path.join(__dirname,'evidencias/sujetos_'+Date.now()+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
