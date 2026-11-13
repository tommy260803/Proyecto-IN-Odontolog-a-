// Sin SQL/Gemini: las guardas deben rechazar antes de importar el backend.
const {test}=require('node:test');const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');const path=require('node:path');
const script=path.join(__dirname,'provisionar_personal_qa.cjs');
test('sin opt-in rechaza antes de conectar',()=>{
 const r=spawnSync(process.execPath,[script,'--crear-o-verificar'],{env:{...process.env,QA_CREATE_BUYER_STAFF_ENSAYO:'false'},encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stdout,/QA_EXPLICIT_OPT_IN_REQUIRED/);assert.doesNotMatch(r.stdout,/"target"/);
});
test('otra base configurada se rechaza antes de conectar',()=>{
 const r=spawnSync(process.execPath,[script,'--crear-o-verificar'],{env:{...process.env,QA_CREATE_BUYER_STAFF_ENSAYO:'true',RUN_SQL_TESTS:'false',TEST_SQLSERVER_URL:'sqlserver://DANIELPC;database=BASE_RECHAZADA'},encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stdout,/QA_CONFIGURED_TARGET_REJECTED/);assert.doesNotMatch(r.stdout,/"target"/);
});
