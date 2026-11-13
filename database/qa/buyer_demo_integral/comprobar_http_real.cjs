// Login/lecturas reales; ningún alta de prospecto, evaluación o llamada Gemini.
// El único POST Buyer prueba rechazo de un cuerpo inválido antes de entrar al handler.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),req=createRequire(path.join(root,'backend/package.json'));
const launcher=require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs');
req('dotenv').config({path:path.join(root,'backend/.env'),quiet:true});
const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';
if(!launcher.configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
const db=new(req('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]});
const result={at:new Date().toISOString(),checks:[],sqlWrites:0,geminiCalls:0,prospectsCreated:0};
let bearer;
const base='http://127.0.0.1:3001/api';
async function call(method,route,{body,auth=false}={}) {
 const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${bearer}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 assert.equal(response.headers.get('x-qa-buyer-revision'),launcher.qaCodeFingerprint(),'QA_RUNNING_CODE_DIFFERS');
 return response;
}
async function snapshot(){
 const counts=await db.$queryRaw`SELECT (SELECT COUNT(*) FROM dbo.Personas) personas,
 (SELECT COUNT(*) FROM dbo.CaptacionesBuyer) captaciones,(SELECT COUNT(*) FROM dbo.Interacciones) interacciones,
 (SELECT COUNT(*) FROM dbo.DecisionesIA) decisiones,(SELECT COUNT(*) FROM dbo.Solicitudes) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa) eventos,(SELECT COUNT(*) FROM dbo.EntradasAgenteLead) entradas`;
 const protected11012=await db.$queryRaw`SELECT p.id_persona,e.nombre etapa,
 (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
 (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes,
 (SELECT COUNT(*) FROM dbo.EventosEtapa ev WHERE ev.id_persona=p.id_persona) eventos
 FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual WHERE p.id_persona=11012`;
 return {counts:counts[0],protected11012};
}
async function main(){
 const [target]=await db.$queryRaw`SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base`;
 assert.equal(target.servidor.toUpperCase(),'DANIELPC');assert.equal(target.base,'NexoSalud_LeadEnsayoFinal');result.target=target;
 result.fingerprint=launcher.qaCodeFingerprint();result.before=await snapshot();
 const anonymousList=await call('GET','/buyer?page=1&pageSize=1');assert.equal(anonymousList.status,401);result.checks.push({name:'listado_sin_sesion',status:401});
 const anonymousCreate=await call('POST','/buyer',{body:{documentNumber:'INVALID_TOO_LONG_FOR_DNI'}});
 assert.equal(anonymousCreate.status,401);result.checks.push({name:'creacion_sin_sesion_rechazada',status:401});
 const credentials=require('../buyer_chatbot_fase3_v2/credencial_local.cjs').read();
 const login=await call('POST','/lead/commercial/staff/session',{body:{email:credentials.email,password:credentials.password}});
 assert.equal(login.status,200);const session=await login.json();
 assert.equal(session.usuario?.id_usuario,5);assert.equal(session.usuario?.rol,'Administrador');
 assert.match(session.token,/^[A-Za-z0-9_-]{43}$/);assert.ok(Date.parse(session.expira_en)>Date.now());bearer=session.token;
 result.checks.push({name:'login_real',status:200,actorId:5,role:'Administrador',futureExpiration:true});
 const list=await call('GET','/buyer?page=1&pageSize=1',{auth:true});assert.equal(list.status,200);const page=await list.json();
 assert.ok(Array.isArray(page.items));result.checks.push({name:'listado_autorizado',status:200,items:page.items.length,total:page.pagination?.total});
 const catalogs=await call('GET','/buyer/catalogs',{auth:true});assert.equal(catalogs.status,200);const data=await catalogs.json();
 assert.ok(data.servicios?.length);assert.ok(data.canales?.length);assert.ok(data.fuentes?.length);
 result.checks.push({name:'catalogos_autorizados',status:200,services:data.servicios.length,channels:data.canales.length,sources:data.fuentes.length,branches:data.sedes?.length??0});
 const blocked=await call('POST','/buyer/register',{auth:true,body:{}});assert.equal(blocked.status,404);result.checks.push({name:'captacion_publica_no_expuesta',status:404});
 for(const pathname of ['/buyer','/buyer/nuevo']) {
  const response=await fetch('http://127.0.0.1:5173'+pathname);assert.equal(response.status,200);assert.match(await response.text(),/src\/main\.tsx/);
  result.checks.push({name:'frontend_spa',path:pathname,status:200});
 }
 const moduleChecks=[
 ['/src/shared/services/staffAuthService.ts',/127\.0\.0\.1:3001\/api/],
 ['/src/modules/buyer/services/buyer.service.ts',/Authorization: `Bearer \$\{token\}`/],
 ['/src/app/layouts/AppLayout.tsx',/navigate\(destination \|\| "\/buyer"\)/]
 ];
 for(const [pathname,pattern] of moduleChecks){const response=await fetch('http://127.0.0.1:5173'+pathname);assert.equal(response.status,200);assert.match(await response.text(),pattern);result.checks.push({name:'modulo_frontend_actual',path:pathname,status:200});}
 const logout=await call('DELETE','/lead/commercial/staff/session',{auth:true});assert.equal(logout.status,204);
 const revoked=await call('GET','/buyer?page=1&pageSize=1',{auth:true});assert.equal(revoked.status,401);bearer=undefined;
 result.checks.push({name:'logout_y_token_revocado',logout:204,nextRead:401});
 result.after=await snapshot();assert.deepEqual(result.after,result.before);result.countsUnchanged=true;result.success=true;
}
main().catch(error=>{result.success=false;result.error=/^[A-Z_0-9]+$/.test(error?.code||'')?error.code:'QA_HTTP_CHECK_FAILED';process.exitCode=1;})
.finally(async()=>{
 if(bearer){try{await call('DELETE','/lead/commercial/staff/session',{auth:true});}catch{}bearer=undefined;}
 await db.$disconnect();
 const file=path.join(__dirname,'evidencias',`http_real_${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
 fs.writeFileSync(file,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
});
