const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const req=createRequire(path.resolve(__dirname,'../../../backend/package.json'));
const {allowedQaOperation,qaAccessGuard,configuredQaTarget}=require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs');
test('lista cerrada: no pública, edición, evaluación general ni recuperación',()=>{
 for(const [method,p] of [['POST','/api/buyer/register'],['PUT','/api/buyer/1'],['POST','/api/buyer/evaluations/recover'],['POST','/api/buyer/1/convert']])assert.equal(allowedQaOperation(method,p),null);
 for(const [method,p] of [['GET','/api/buyer'],['POST','/api/buyer'],['GET','/api/buyer/catalogs'],['GET','/api/buyer/check-duplicate']])assert.equal(allowedQaOperation(method,p),'admin');
 assert.equal(configuredQaTarget('sqlserver://localhost;database=NexoSalud_LeadEnsayoFinal;','OTHER'),false);
 assert.equal(configuredQaTarget('sqlserver://DANIELPC;database=production;'),false);
});
test('HTTP real del guard aislado: sesión y permisos antes de handlers (dependencias de identidad simuladas)',async()=>{
 const app=req('express')();let reached=0;
 const staff={leadStaffAuthMode:()=> 'enabled',getLeadStaffIdentity:async r=>r.get('Authorization')==='Bearer admin'?{id_usuario:5,rol:'Administrador'}:r.get('Authorization')==='Bearer neg'?{id_usuario:2,rol:'Negociador'}:null};
 app.use(qaAccessGuard(staff,{},async(_db,id)=>id===10));app.use((_r,s)=>{reached++;s.json({ok:true});});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
 try{const base=`http://127.0.0.1:${server.address().port}`;
 for(const method of ['GET','POST']){assert.equal((await fetch(base+'/api/buyer',{method})).status,401);assert.equal((await fetch(base+'/api/buyer',{method,headers:{Authorization:'Bearer neg'}})).status,403);}
 assert.equal(reached,0);
 assert.equal((await fetch(base+'/api/buyer',{headers:{Authorization:'Bearer admin'}})).status,200);
 assert.equal((await fetch(base+'/api/buyer/11',{headers:{Authorization:'Bearer neg'}})).status,403);
 assert.equal((await fetch(base+'/api/buyer/10',{headers:{Authorization:'Bearer neg'}})).status,200);
 assert.equal((await fetch(base+'/api/buyer/register',{method:'POST',headers:{Authorization:'Bearer admin'}})).status,404);
 assert.equal(reached,2);
 }finally{await new Promise(r=>server.close(r));}
});
