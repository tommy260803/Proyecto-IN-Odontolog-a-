// Solo lectura: confirma la guarda del procedimiento REAL y el vínculo sintético.
const path=require('node:path'),fs=require('node:fs');
const req=require('node:module').createRequire(path.resolve(__dirname,'../../../backend/package.json'));
req('dotenv').config({path:path.resolve(__dirname,'../../../backend/.env'),quiet:true});
const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';
if(!require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs').configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
const db=new(req('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]});
(async()=>{
 const [target]=await db.$queryRawUnsafe('SELECT @@SERVERNAME servidor,DB_NAME() base');
 if(target.servidor!=='DANIELPC'||target.base!=='NexoSalud_LeadEnsayoFinal')throw Error('QA_EFFECTIVE_TARGET_REJECTED');
 const rows=await db.$queryRawUnsafe(`SELECT p.name,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256,
 SUBSTRING(m.definition,CHARINDEX('IF @@TRANCOUNT',m.definition),210) guarda_transaccion
 FROM sys.procedures p JOIN sys.sql_modules m ON m.object_id=p.object_id WHERE p.object_id=OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead')`);
 const links=await db.$queryRawUnsafe(`SELECT i.id_interaccion,i.id_solicitud,e.id_evento_etapa,
  l.id_solicitud recepcion,JSON_VALUE(d.decision,'$.entregaLeadEstado') entrega
  FROM dbo.Interacciones i JOIN dbo.EventosEtapa e ON e.id_solicitud=i.id_solicitud
  LEFT JOIN dbo.EntradasAgenteLead l ON l.id_solicitud=i.id_solicitud
  JOIN dbo.DecisionesIA d ON d.id_interaccion=i.id_interaccion AND d.agente='BUYER'
  WHERE i.id_persona=11000 AND i.id_interaccion=20223`);
 const result={at:new Date().toISOString(),readOnly:true,target,procedures:rows,links};
 fs.writeFileSync(path.join(__dirname,'evidencias/diagnostico_recepcion_'+Date.now()+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(()=>{console.log('QA_DIAG_FAILED');process.exitCode=1;}).finally(()=>db.$disconnect());
