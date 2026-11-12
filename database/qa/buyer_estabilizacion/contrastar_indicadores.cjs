// GET del router real y SELECT independiente equivalente. No escribe SQL ni llama a modelos.
const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const {once}=require('node:events');
const {prepare}=require('../buyer_backend/entorno_qa.cjs');
const {inspect}=require('../buyer_backend/consultas_qa.cjs');
const env=prepare();let db,server;
const result={version:env.version,prefix:env.prefix,cases:[],startedUtc:new Date().toISOString()};
(async()=>{try{
 env.backendRequire('tsx/cjs');({prisma:db}=env.backendRequire('./src/db.ts'));result.inspection=await inspect(db);
 const express=env.backendRequire('express'),app=express();app.use('/api/buyer',env.backendRequire('./src/routes/buyer.routes.ts').default);
 server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const sql=fs.readFileSync(path.join(__dirname,'contrastar_indicadores.sql'),'utf8');
 const [channel]=await db.$queryRaw`SELECT TOP(1) nombre FROM dbo.Canales WHERE activo=1 ORDER BY id_canal`;
 const matrix=[{name:'historico'},{name:'hoy',from:'2026-11-12',to:'2026-11-12'},
  {name:'sinteticos_live',search:'QA_BBE_20261112T223700Z_a11e'},
  {name:'convertidos',state:'CONVERTED'}, {name:'nuevos',state:'NEW'},
  {name:'canal',channel:channel.nombre},{name:'vacio',search:'QA_NO_EXISTE_22a1e'},
  {name:'pagina2',page:'2',pageSize:'2'}];
 const cases=process.env.QA_INDICATOR_FINAL_ONLY==='true'?[matrix[0]]:matrix;
 const number=v=>v===null?null:Number(v);
 for(const c of cases){
  const q=new URLSearchParams({page:c.page||'1',pageSize:c.pageSize||'5'});
  if(c.search)q.set('search',c.search);if(c.state)q.set('states',c.state);if(c.channel)q.set('channels',c.channel);
  if(c.from)q.set('fromDate',c.from);if(c.to)q.set('toDate',c.to);
  const response=await fetch(base+'/api/buyer?'+q);const body=await response.json();
  const item={name:c.name,query:q.toString(),status:response.status,http:body.indicators};result.cases.push(item);
  assert.equal(response.status,200);assert(body.indicators);
  const desde=c.from?new Date(c.from+'T00:00:00').toISOString():'';
  const hasta=c.to?new Date(c.to+'T23:59:59.999').toISOString():'';
  const [r]=await db.$queryRawUnsafe(sql,c.search||'',c.state||'',c.channel||'',desde,hasta);item.sql=r;
  const a=body.indicators;
  const comparisons=[['b1_n',a.b1.numerator,r.b1_n],['b1_d',a.b1.denominator,r.b1_d],['b1_rate',a.b1.rate,r.b1_porcentaje],
    ['b2_n',a.b2.numerator,r.b2_n],['b2_d',a.b2.denominator,r.b2_d],['b2_rate',a.b2.rate,r.b2_porcentaje],
    ['b3_d',a.b3.conversions,r.b3_d],['b3_total',a.b3.totalDays,r.b3_total_dias],['b3_avg',a.b3.averageDays,r.b3_promedio_dias]];
  item.comparisons=comparisons.map(([name,actual,expected])=>({name,actual,expected:number(expected),passed:actual===null?expected===null:expected!==null&&Math.abs(actual-number(expected))<0.0001}));
  assert(item.comparisons.every(x=>x.passed),JSON.stringify(item.comparisons.filter(x=>!x.passed)));
  item.result='APROBADO';
 }
 result.result='APROBADO';
}catch(e){result.result='FALLO';result.error={name:e.name,message:env.scrub(e.message)};}
finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(db)await db.$disconnect();result.finishedUtc=new Date().toISOString();env.save('INDICADORES_RESULTADOS.json',result);console.log(JSON.stringify({result:result.result,evidence:env.output,cases:result.cases.map(x=>({name:x.name,result:x.result,http:x.http,sql:x.sql})),error:result.error},(_,v)=>typeof v==='bigint'?v.toString():v,2));process.exitCode=result.result==='APROBADO'?0:1;}})();
