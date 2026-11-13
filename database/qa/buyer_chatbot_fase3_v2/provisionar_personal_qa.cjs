// Operación excepcional autorizada: UNA cuenta sintética en EnsayoFinal.
// No sustituye ni modifica el provisionador de producción/LeadPruebas.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'backend/package.json'));
const local = require('./credencial_local.cjs');
const { configuredQaTarget } = require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs');
const marker = { nombres: 'QA_BUYER_CHAT_ENSAYOFINAL', apellidos: 'CUENTA_SINTETICA_FASE3' };
const email = 'qa.buyer.chat.ensayofinal@example.invalid';
let prisma;
const result = {at: new Date().toISOString(), operation:'CREATE_OR_VERIFY_EXCLUSIVE_QA_STAFF'};
async function main() {
  if(process.env.QA_CREATE_BUYER_STAFF_ENSAYO !== 'true' || !process.argv.includes('--crear-o-verificar')) throw Error('QA_EXPLICIT_OPT_IN_REQUIRED');
  req('dotenv').config({path:path.join(root,'backend/.env'),quiet:true});
  const url = process.env.TEST_SQLSERVER_URL || process.env.SQLSERVER_URL || '';
  if(process.env.RUN_SQL_TESTS !== 'false' || !configuredQaTarget(url)) throw Error('QA_CONFIGURED_TARGET_REJECTED');
  req('tsx/cjs');
  // Cliente silencioso para no volcar parámetros de una escritura fallida.
  // La función criptográfica real importa db.ts, pero ese singleton no consulta.
  const { PrismaClient }=req('@prisma/client');
  prisma = new PrismaClient({datasources:{db:{url}},log:[]});
  const [target] = await prisma.$queryRaw`SELECT @@SERVERNAME servidor, DB_NAME() base`;
  if(String(target?.servidor).toUpperCase() !== 'DANIELPC' || target?.base !== 'NexoSalud_LeadEnsayoFinal') throw Error('QA_EFFECTIVE_TARGET_REJECTED');
  result.target = target;
  const { hashLeadStaffPassword } = req('./src/services/leadStaffAuth.ts');
  local.prepare();
  let secret = fs.existsSync(local.credentialPath) ? local.read() : null;
  if(secret && (secret.email !== email || secret.server !== target.servidor || secret.database !== target.base || typeof secret.password !== 'string')) throw Error('QA_LOCAL_CREDENTIAL_MISMATCH');
  const outcome = await prisma.$transaction(async tx => {
    const lock = await tx.$queryRaw`DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='QA_BUYER_CHAT_STAFF_ENSAYOFINAL', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; SELECT @r result`;
    if(lock[0]?.result < 0) throw Error('QA_ACCOUNT_LOCK_FAILED');
    const [inside] = await tx.$queryRaw`SELECT @@SERVERNAME servidor, DB_NAME() base`;
    if(inside.servidor !== target.servidor || inside.base !== target.base) throw Error('QA_TRANSACTION_TARGET_REJECTED');
    const role = await tx.roles.findUnique({where:{nombre:'Administrador'}});
    if(!role) throw Error('QA_EXISTING_ADMIN_ROLE_REQUIRED');
    if(!secret && fs.existsSync(local.credentialPath)) secret=local.read();
    if(secret && (secret.email!==email || secret.server!==target.servidor || secret.database!==target.base || typeof secret.password!=='string')) throw Error('QA_LOCAL_CREDENTIAL_MISMATCH');
    // Comparación privada en memoria: ninguna credencial se serializa en evidencia.
    const before = await tx.usuarios.findMany({where:{email:{not:email}},orderBy:{id_usuario:'asc'}});
    let user = await tx.usuarios.findUnique({where:{email}});
    const created = !user;
    if(user) {
      if(user.nombres !== marker.nombres || user.apellidos !== marker.apellidos || user.id_rol !== role.id_rol || !user.activo || !/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(user.password_hash)) throw Error('QA_EXISTING_ACCOUNT_MISMATCH');
      if(!secret) throw Error('QA_EXISTING_ACCOUNT_SECRET_MISSING_NO_RESET');
    } else {
      if(!secret) {
        secret={email,password:crypto.randomBytes(32).toString('base64url'),server:target.servidor,database:target.base,purpose:marker.nombres};
        // Escribir primero: un commit seguido de interrupción no pierde la clave.
        local.create(secret);
      }
      const password_hash=await hashLeadStaffPassword(secret.password);
      user=await tx.usuarios.create({data:{...marker,email,password_hash,id_rol:role.id_rol,activo:true}});
    }
    const after=await tx.usuarios.findMany({where:{email:{not:email}},orderBy:{id_usuario:'asc'}});
    if(JSON.stringify(before)!==JSON.stringify(after)) throw Error('QA_OTHER_USERS_CHANGED');
    return {created,id_usuario:user.id_usuario,rol:role.nombre,active:user.activo,otherUsersUnchanged:true,otherUsersCount:before.length,passwordReset:false};
  }, {isolationLevel:'ReadCommitted', timeout:20000});
  Object.assign(result,outcome,{credentialStorage:'EXTERNAL_CURRENT_USER_ONLY_ACL', compatibleFormat:true});
}
main().catch(error=>{result.error=/^QA_[A-Z_]+$/.test(error?.message||'')?error.message:'QA_PROVISION_FAILED';process.exitCode=1;})
  .finally(async()=>{
    if(prisma) await prisma.$disconnect().catch(()=>undefined);
    fs.mkdirSync(path.join(__dirname,'evidencias'),{recursive:true});
    const filename=`personal_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    fs.writeFileSync(path.join(__dirname,'evidencias',filename),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  });
