// Exclusivamente SELECT. Sin index.ts, SDK Gemini, credenciales exportadas ni escrituras.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),req=createRequire(path.join(root,'backend/package.json'));
req('dotenv').config({path:path.join(root,'backend/.env'),quiet:true});
const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';
if(!require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs').configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
const db=new(req('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]});
async function main(){
 const [target]=await db.$queryRaw`SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base`;
 if(target.servidor.toUpperCase()!=='DANIELPC'||target.base!=='NexoSalud_LeadEnsayoFinal')throw Error('QA_EFFECTIVE_TARGET_REJECTED');
 const staff=await db.$queryRaw`SELECT u.id_usuario,u.nombres,u.apellidos,u.activo,r.nombre rol,
 CASE WHEN LEN(u.password_hash)=107 AND LEFT(u.password_hash,10) COLLATE Latin1_General_100_BIN2='scrypt-v1$'
 AND SUBSTRING(u.password_hash,43,1)='$' AND SUBSTRING(u.password_hash,11,32) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-f]%'
 AND SUBSTRING(u.password_hash,44,64) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-f]%' THEN 1 ELSE 0 END credencial_compatible
 FROM dbo.Usuarios u JOIN dbo.Roles r ON r.id_rol=u.id_rol
 WHERE u.apellidos COLLATE Latin1_General_CI_AI LIKE '%benit%' OR u.nombres COLLATE Latin1_General_CI_AI LIKE '%benit%' OR u.id_usuario=5`;
 const fixturePrefix='QA_DEMO_UI_20261113';
 const people=await db.$queryRaw`SELECT p.id_persona,p.nombres,p.apellidos,e.nombre etapa,p.autoriza_contacto,
 (SELECT COUNT(*) FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) captaciones,
 (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
 (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa ev WHERE ev.id_persona=p.id_persona) eventos,
 (SELECT COUNT(*) FROM dbo.EntradasAgenteLead en WHERE en.id_persona=p.id_persona) entradas
 FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual WHERE p.nombres LIKE ${fixturePrefix+'%'}`;
 const services=await db.servicios.findMany({where:{activo:true},select:{id_servicio:true,nombre:true}});
 const data={at:new Date().toISOString(),readOnly:true,target,staff,fixturePrefix,people,services};
 const dir=path.join(__dirname,'evidencias');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,`sql_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);fs.writeFileSync(file,JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));
}
main().catch(()=>{console.error('QA_INSPECTION_FAILED');process.exitCode=1;}).finally(()=>db.$disconnect());
