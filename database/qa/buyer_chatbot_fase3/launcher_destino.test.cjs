// Prueba unitaria de la guarda: no ejecuta main, importa Prisma ni conecta SQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { configuredQaTarget } = require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs');
const url = host => `sqlserver://${host}:1433;database=NexoSalud_LeadEnsayoFinal;encrypt=true`;
test('nombre canónico QA admitido',()=>assert.equal(configuredQaTarget(url('DANIELPC'),'DanielPC'),true));
test('localhost solo en DanielPC',()=>{
  assert.equal(configuredQaTarget(url('localhost'),'DanielPC'),true);
  assert.equal(configuredQaTarget(url('localhost'),'OTROPC'),false);
});
test('127.0.0.1 solo en DanielPC',()=>{
  assert.equal(configuredQaTarget(url('127.0.0.1'),'DANIELPC'),true);
  assert.equal(configuredQaTarget(url('127.0.0.1'),'OTROPC'),false);
});
test('otro servidor y nombres parecidos se rechazan',()=>{
  for(const host of ['OTROPC','DANIELPC.ejemplo','localhost.ejemplo','127.0.0.2'])assert.equal(configuredQaTarget(url(host),'DANIELPC'),false);
});
test('otra base y base duplicada se rechazan',()=>{
  assert.equal(configuredQaTarget(url('DANIELPC').replace('LeadEnsayoFinal','LeadPruebas'),'DANIELPC'),false);
  assert.equal(configuredQaTarget(url('localhost')+';database=OTRA','DANIELPC'),false);
});
test('conexión vacía o sin base se rechaza',()=>{
  assert.equal(configuredQaTarget('','DANIELPC'),false);
  assert.equal(configuredQaTarget('sqlserver://localhost:1433;encrypt=true','DANIELPC'),false);
});
