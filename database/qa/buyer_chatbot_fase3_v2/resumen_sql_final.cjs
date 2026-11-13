// Ejecuta exclusivamente las SELECT etiquetadas. Sin SQL dinámico del modelo.
const fs=require('node:fs'),path=require('node:path');
const req=require('node:module').createRequire(path.resolve(__dirname,'../../../backend/package.json'));
let db;const result={at:new Date().toISOString(),readOnly:true};
(async()=>{
 req('dotenv').config({path:path.resolve(__dirname,'../../../backend/.env'),quiet:true});
 const url=process.env.TEST_SQLSERVER_URL||process.env.SQLSERVER_URL||'';
 if(!require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs').configuredQaTarget(url))throw Error('QA_CONFIGURED_TARGET_REJECTED');
 db=new(req('@prisma/client').PrismaClient)({datasources:{db:{url}},log:[]});
 const [target]=await db.$queryRawUnsafe('SELECT @@SERVERNAME servidor,DB_NAME() base');
 if(target.servidor!=='DANIELPC'||target.base!=='NexoSalud_LeadEnsayoFinal')throw Error('QA_EFFECTIVE_TARGET_REJECTED');result.target=target;
 const sql=fs.readFileSync(path.join(__dirname,'CONSULTAS_VALIDACION_V2.sql'),'utf8');
 for(const block of sql.split('-- QA_RESULT: ').slice(1)){
  const newline=block.indexOf('\n'),name=block.slice(0,newline).trim(),query=block.slice(newline+1);
  if(!/^\s*SELECT\b/i.test(query)||/\b(?:INSERT|UPDATE|DELETE|EXEC|MERGE|ALTER|DROP|TRUNCATE)\b/i.test(query))throw Error('QA_READ_ONLY_QUERY_REQUIRED');
  result[name]=await db.$queryRawUnsafe(query);
 }
})().catch(()=>{result.error='QA_READ_ONLY_CHECK_FAILED';process.exitCode=1;})
 .finally(async()=>{if(db)await db.$disconnect();fs.writeFileSync(path.join(__dirname,'evidencias/resumen_sql_final.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
