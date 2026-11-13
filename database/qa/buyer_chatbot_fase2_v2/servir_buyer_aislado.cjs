// Arranque opt-in para la futura prueba real del panel, NO ejecutado en este bloque.
// No importa index.ts, dunning ni recuperadores. No sustituye autenticación o SQL.
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const fromBackend = createRequire(path.join(root, 'backend/package.json'));
let prisma;
function qaCodeFingerprint() {
  const fs=require('node:fs'),crypto=require('node:crypto');
  const hash=crypto.createHash('sha256');
  const paths=['database/qa/buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs',
    'backend/src/db.ts','backend/src/routes/buyer.routes.ts','backend/src/routes/buyerConversation.routes.ts',
    'backend/src/services/buyerChatAccess.ts','backend/src/services/leadStaffAuth.ts',
    'backend/src/services/buyerConversationService.ts','backend/src/services/buyerEvaluationService.ts',
    'backend/src/services/buyerMessageClassifier.ts','backend/src/services/leadIntake.ts','backend/src/types/buyer.ts'];
  for(const file of paths)hash.update(file+'\0').update(fs.readFileSync(path.join(root,file))).update('\0');
  return hash.digest('hex');
}
function allowedQaOperation(method, p) {
  if (p === '/api/lead/commercial/staff/session' && ['POST','DELETE'].includes(method)) return 'session';
  if (method === 'GET' && /^\/api\/buyer(?:\/)?$/.test(p)) return 'admin';
  if (method === 'GET' && /^\/api\/buyer\/(?:catalogs|check-duplicate)$/.test(p)) return 'admin';
  if (method === 'POST' && /^\/api\/buyer(?:\/)?$/.test(p)) return 'admin';
  if (method === 'GET' && /^\/api\/buyer\/\d+$/.test(p)) return 'detail';
  if (method === 'GET' && /^\/api\/buyer\/\d+\/conversations(?:\/[a-f0-9-]{36})?$/.test(p)) return 'chat';
  if (method === 'POST' && /^\/api\/buyer\/\d+\/conversations\/(?:messages|[a-f0-9-]{36}\/turns\/\d+\/retry)$/.test(p)) return 'chat';
  return null;
}
function qaAccessGuard(staff, db, assigned) {
  return async (req,res,next) => {
    const operation=allowedQaOperation(req.method,req.path);
    if(!operation)return res.sendStatus(404);
    if(operation==='session')return next();
    if(staff.leadStaffAuthMode()!=='enabled')return res.sendStatus(404);
    try {
      const identity=await staff.getLeadStaffIdentity(req,db);
      if(!identity)return res.status(401).json({error:'Inicia sesión con personal autorizado.'});
      if(identity.rol!=='Administrador') {
        if(identity.rol!=='Negociador'||operation==='admin')return res.sendStatus(403);
        const personId=Number(req.path.split('/')[3]);
        if(!await assigned(db,personId,identity.id_usuario))return res.sendStatus(403);
      }
      res.set('Cache-Control','no-store');
      return next();
    } catch {return res.status(503).json({error:'No se pudo comprobar la autorización.'});}
  };
}
function configuredQaTarget(url, localMachine = os.hostname()) {
  const address = url.match(/^sqlserver:\/\/(DANIELPC|localhost|127\.0\.0\.1)(?::\d+)?;/i);
  const databases = [...url.matchAll(/(?:^|;)database=([^;]*)(?=;|$)/gi)];
  if (!address || databases.length !== 1 || databases[0][1] !== 'NexoSalud_LeadEnsayoFinal') return false;
  // Loopback solo en la máquina QA identificada. La guarda SELECT efectiva de
  // abajo sigue siendo obligatoria antes de escuchar o aceptar escrituras.
  return address[1].toUpperCase() === 'DANIELPC' || localMachine.toUpperCase() === 'DANIELPC';
}
async function main() {
  if (process.env.QA_BUYER_CHAT_REAL !== 'true') throw Error('QA_OPT_IN_REQUIRED');
  fromBackend('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
  if (process.env.LEAD_STAFF_AUTH_ENABLED !== 'true' || process.env.LEAD_STAFF_AUTH_QA === 'true' ||
      process.env.DISABLE_MART_SYNC !== 'true' || process.env.DUNNING_ENABLED !== 'false' ||
      process.env.RUN_SQL_TESTS !== 'false') throw Error('QA_FLAGS_REQUIRED');
  // Rechazo previo a conectar: formato Prisma SQL Server explícito y destino único.
  // No se reescribe ni imprime la conexión. Formatos distintos requieren revisión.
  const url = process.env.TEST_SQLSERVER_URL || process.env.SQLSERVER_URL || '';
  if (!configuredQaTarget(url)) throw Error('QA_CONNECTION_TARGET_REJECTED');
  fromBackend('tsx/cjs');
  prisma = fromBackend('./src/db.ts').prisma;
  const [target] = await prisma.$queryRaw`SELECT @@SERVERNAME AS servidor, DB_NAME() AS base`;
  if (String(target?.servidor).toUpperCase() !== 'DANIELPC' || target?.base !== 'NexoSalud_LeadEnsayoFinal') {
    throw Error('QA_EFFECTIVE_TARGET_REJECTED');
  }
  const express = fromBackend('express');
  const app = express();
  const fingerprint=qaCodeFingerprint();
  app.use((_req,res,next)=>{res.set('X-QA-Buyer-Revision',fingerprint);next();});
  app.use(fromBackend('cors')({ origin: 'http://127.0.0.1:5173' }));
  app.use(express.json());
  const staff = fromBackend('./src/services/leadStaffAuth.ts');
  // Lista cerrada + sesión real antes incluso de catálogos/deduplicación.
  // Creación/listado administrativos solo Administrador; no inventar asignación
  // a través de una solicitud comercial anticipada para habilitar un Negociador.
  if(process.env.QA_BUYER_HTTP_EVIDENCE==='true') {
    const fs=require('node:fs');
    const dir=path.join(root,'database/qa/buyer_demo_integral/evidencias');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`http_${new Date().toISOString().replace(/[:.]/g,'-')}.jsonl`);
    app.use((req,res,next)=>{
      const json=res.json.bind(res);let summary;
      res.json=body=>{
        // Lista cerrada: jamás token, contraseña, correo, cuerpo original o headers.
        if(req.path.startsWith('/api/buyer'))summary={personId:body?.personId??body?.id_persona??body?.id,
          conversationId:body?.conversationId,turnId:body?.turnId,interactionId:body?.interactionId,
          status:body?.status,action:body?.evaluation?.accion,stage:body?.evaluation?.etapa_final,
          requestId:body?.evaluation?.id_solicitud,eventId:body?.evaluation?.id_evento_etapa,
          replayed:body?.replayed,code:body?.code};
        return json(body);
      };
      res.on('finish',()=>fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),method:req.method,path:req.path,status:res.statusCode,...summary})+'\n'));
      next();
    });
  }
  app.use(qaAccessGuard(staff,prisma,fromBackend('./src/services/buyerChatAccess.ts').assignedBuyerRequest));
  app.post('/api/lead/commercial/staff/session', staff.loginLeadStaff);
  app.delete('/api/lead/commercial/staff/session', staff.logoutLeadStaff);
  app.use('/api/buyer', fromBackend('./src/routes/buyer.routes.ts').default);
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(3001, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => {
    server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });
  });
  console.log('QA Buyer aislado: http://127.0.0.1:3001 · DANIELPC / NexoSalud_LeadEnsayoFinal');
}
module.exports = { configuredQaTarget, allowedQaOperation, qaAccessGuard, qaCodeFingerprint };
if (require.main === module) main().catch(async error => {
  // Evitar cadenas de conexión, claves o detalles del proveedor en consola.
  const safe = /^(?:QA_[A-Z_]+|EADDRINUSE)$/.test(error?.message || '') ? error.message : 'QA_START_FAILED';
  console.error(safe);
  if (prisma) await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
