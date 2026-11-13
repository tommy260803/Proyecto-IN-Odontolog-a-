// Solo SELECT/metadatos. No importa index.ts, rutas, recuperadores ni el SDK Gemini.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'backend/package.json'));
req('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });
const required = {
  Personas: ['id_persona','nombres','apellidos','email','numero','dni','id_etapa_actual','autoriza_contacto','estado_calidad'],
  CaptacionesBuyer: ['id_captacion','id_persona','id_servicio','fecha_captacion'],
  Interacciones: ['id_interaccion','id_persona','id_usuario','id_solicitud','tipo','mensaje','fecha_hora','resultado'],
  DecisionesIA: ['id_decision','id_persona','id_usuario','id_captacion','id_interaccion','agente','entrada','decision','accion','requiere_revision','resultado_revision'],
  PersonaPreferencias: ['id_preferencia','id_persona','id_servicio_interes','sede_preferida','id_horario','fecha_fin'],
  Horarios: ['id_horario','hora_inicio','hora_fin'], Servicios: ['id_servicio','nombre','activo'],
  Etapas: ['id_etapa','nombre'], Usuarios: ['id_usuario','id_rol','activo','email','password_hash'], Roles: ['id_rol','nombre'],
  Solicitudes: ['id_solicitud','id_persona','id_servicio','id_negociador','estado','fecha_ingreso_lead'],
  EventosEtapa: ['id_evento_etapa','id_persona','id_solicitud','id_captacion','clave_operacion_buyer','etapa_origen','etapa_destino'],
  EntradasAgenteLead: ['id_solicitud','id_evento_etapa','id_persona','id_captacion'],
};
// Prisma lee también los escalares no seleccionados explícitamente; contrastar
// todos los campos de estos modelos, sin incluir relaciones ni tocar el esquema.
const prismaSchema=fs.readFileSync(path.join(root,'backend/prisma/schema.prisma'),'utf8');
for(const [name,fields] of Object.entries(required)) {
  const block=prismaSchema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1]||'';
  for(const line of block.split('\n')) {
    const scalar=line.match(/^\s*(\w+)\s+(?:String|Int|BigInt|Float|Decimal|DateTime|Boolean|Bytes)\??\s/);
    if(scalar && !fields.includes(scalar[1]))fields.push(scalar[1]);
  }
}
let db;
const result = { at: new Date().toISOString(), readOnly: true, sqlWrites: 0, geminiCalls: 0, blockers: [] };
async function main() {
  const url = process.env.TEST_SQLSERVER_URL || process.env.SQLSERVER_URL || '';
  const host = url.match(/^sqlserver:\/\/([^;:]+)/i)?.[1];
  const dbs = [...url.matchAll(/(?:^|;)database=([^;]*)(?=;|$)/gi)].map(m=>m[1]);
  result.configuration = { source: process.env.TEST_SQLSERVER_URL?'TEST_SQLSERVER_URL':'SQLSERVER_URL',
    host, database: dbs.length===1?dbs[0]:null, localMachine: os.hostname(),
    launcherLiteralCompatible: host?.toUpperCase()==='DANIELPC',
    launcherGuardAfterCorrection: require('../buyer_chatbot_fase2_v2/servir_buyer_aislado.cjs').configuredQaTarget(url,os.hostname()),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    configuredStaffMode: process.env.LEAD_STAFF_AUTH_QA==='true'?'qa':process.env.LEAD_STAFF_AUTH_ENABLED==='true'?'enabled':'disabled',
    isolation: { DISABLE_MART_SYNC: process.env.DISABLE_MART_SYNC, ENABLE_MART_SYNC: process.env.ENABLE_MART_SYNC,
      DUNNING_ENABLED: process.env.DUNNING_ENABLED, RUN_SQL_TESTS: process.env.RUN_SQL_TESTS } };
  if (!['DANIELPC','LOCALHOST','127.0.0.1'].includes(host?.toUpperCase()) || os.hostname().toUpperCase()!=='DANIELPC' ||
      dbs.length!==1 || dbs[0]!=='NexoSalud_LeadEnsayoFinal') throw Error('QA_CONFIGURED_TARGET_REJECTED');
  const { PrismaClient } = req('@prisma/client');
  db = new PrismaClient({datasources:{db:{url}},log:[]});
  const [target] = await db.$queryRawUnsafe('SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base,SYSUTCDATETIME() utc');
  result.target = target;
  if (target.servidor.toUpperCase()!=='DANIELPC' || target.base!=='NexoSalud_LeadEnsayoFinal') throw Error('QA_EFFECTIVE_TARGET_REJECTED');
  const columns = await db.$queryRawUnsafe(`SELECT t.name tabla,c.name columna,ty.name tipo,c.max_length,c.is_nullable
    FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id
    JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE s.name='dbo' ORDER BY t.name,c.column_id`);
  result.columns = columns.filter(c=>required[c.tabla]);
  result.missingColumns = Object.entries(required).flatMap(([table,names])=>names.filter(name=>!columns.some(c=>c.tabla===table&&c.columna===name)).map(name=>`${table}.${name}`));
  result.maxText = ['DecisionesIA.entrada','Interacciones.mensaje'].map(field=>{
    const [table,name]=field.split('.');return {field,isMax:columns.some(c=>c.tabla===table&&c.columna===name&&c.max_length===-1)};
  });
  result.procedures = await db.$queryRawUnsafe(`SELECT p.name,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256,
    m.uses_ansi_nulls,m.uses_quoted_identifier FROM sys.procedures p JOIN sys.sql_modules m ON m.object_id=p.object_id
    WHERE p.object_id IN(OBJECT_ID('dbo.usp_ConvertirBuyerALead'),OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead')) ORDER BY p.name`);
  result.procedureDependencies = await db.$queryRawUnsafe(`SELECT OBJECT_NAME(referencing_id) procedimiento,referenced_schema_name,referenced_entity_name
    FROM sys.sql_expression_dependencies WHERE referencing_id IN(OBJECT_ID('dbo.usp_ConvertirBuyerALead'),OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead'))`);
  result.supportingView=await db.$queryRawUnsafe(`SELECT v.name,CONVERT(varchar(64),HASHBYTES('SHA2_256',m.definition),2) sha256
    FROM sys.views v JOIN sys.sql_modules m ON m.object_id=v.object_id WHERE v.object_id=OBJECT_ID('dbo.v_DatosCaptacionBuyer')`);
  result.constraints = await db.$queryRawUnsafe(`SELECT OBJECT_NAME(parent_object_id) tabla,name,definition,is_disabled FROM sys.check_constraints
    WHERE parent_object_id IN(OBJECT_ID('dbo.Interacciones'),OBJECT_ID('dbo.DecisionesIA'))`);
  if(result.missingColumns.length || result.maxText.some(t=>!t.isMax) || result.procedures.length!==2 || result.supportingView.length!==1) result.blockers.push('SQL_PREREQUISITES_MISSING');
  if(!result.missingColumns.length) {
    // Formato compatible evaluado dentro de SQL: jamás seleccionar/imprimir el hash.
    result.staff = await db.$queryRawUnsafe(`SELECT u.id_usuario,r.nombre rol,u.activo,
      CASE WHEN LEN(u.password_hash)=107 AND LEFT(u.password_hash,10) COLLATE Latin1_General_100_BIN2='scrypt-v1$'
        AND SUBSTRING(u.password_hash,43,1)='$'
        AND SUBSTRING(u.password_hash,11,32) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-f]%'
        AND SUBSTRING(u.password_hash,44,64) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-f]%'
        THEN 1 ELSE 0 END formato_compatible
      FROM dbo.Usuarios u JOIN dbo.Roles r ON r.id_rol=u.id_rol
      WHERE u.activo=1 AND r.nombre IN('Administrador','Negociador') ORDER BY u.id_usuario`);
    result.compatibleStaffCount=result.staff.filter(u=>u.formato_compatible===1).length;
    if(!result.compatibleStaffCount) result.blockers.push('NO_COMPATIBLE_ACTIVE_STAFF_ACCOUNT');
    result.stages=await db.$queryRawUnsafe("SELECT id_etapa,nombre FROM dbo.Etapas WHERE nombre IN('BUYER','LEAD','PAYER') ORDER BY id_etapa");
    result.activeServices=await db.$queryRawUnsafe('SELECT id_servicio,nombre FROM dbo.Servicios WHERE activo=1 ORDER BY id_servicio');
    result.syntheticSubjects=await db.$queryRawUnsafe(`SELECT p.id_persona,e.nombre etapa,
      CASE WHEN p.nombres LIKE 'QA[_]%' THEN 1 ELSE 0 END prefijo_qa,
      p.autoriza_contacto,p.estado_calidad,
      CASE WHEN NULLIF(p.numero,'') IS NOT NULL THEN 1 ELSE 0 END tiene_telefono,
      CASE WHEN NULLIF(LTRIM(RTRIM(p.email)),'') IS NOT NULL THEN 1 ELSE 0 END tiene_email,
      CASE WHEN NULLIF(LTRIM(RTRIM(p.nombres)),'') IS NOT NULL AND NULLIF(LTRIM(RTRIM(p.apellidos)),'') IS NOT NULL THEN 1 ELSE 0 END nombre_completo,
      (SELECT COUNT(*) FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) captaciones,
      (SELECT COUNT(*) FROM dbo.Interacciones i WHERE i.id_persona=p.id_persona) interacciones,
      (SELECT COUNT(*) FROM dbo.DecisionesIA d WHERE d.id_persona=p.id_persona AND d.agente='BUYER_CHAT') decisiones_chat,
      (SELECT COUNT(*) FROM dbo.Solicitudes s WHERE s.id_persona=p.id_persona) solicitudes
      FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
      WHERE p.id_persona IN(11000,11001,11002,11007) AND p.nombres LIKE 'QA[_]%' ORDER BY p.id_persona`);
    result.historicalEvents=await db.$queryRawUnsafe(`SELECT e.id_persona,e.id_evento_etapa,e.id_solicitud,e.id_captacion,
      eo.nombre etapa_origen,ed.nombre etapa_destino,
      CASE WHEN l.id_solicitud IS NOT NULL THEN 1 ELSE 0 END recepcion_existente
      FROM dbo.EventosEtapa e JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino
      LEFT JOIN dbo.EntradasAgenteLead l ON l.id_solicitud=e.id_solicitud
      WHERE e.id_persona IN(11000,11001,11002,11007) AND eo.nombre='BUYER' AND ed.nombre='LEAD' ORDER BY e.id_persona,e.id_evento_etapa`);
    result.tableCounts=await db.$queryRawUnsafe(`SELECT (SELECT COUNT_BIG(*) FROM dbo.Personas) personas,
      (SELECT COUNT_BIG(*) FROM dbo.Interacciones) interacciones,(SELECT COUNT_BIG(*) FROM dbo.DecisionesIA) decisiones,
      (SELECT COUNT_BIG(*) FROM dbo.Solicitudes) solicitudes,(SELECT COUNT_BIG(*) FROM dbo.EventosEtapa) eventos,
      (SELECT COUNT_BIG(*) FROM dbo.EntradasAgenteLead) entradas`);
  }
  try {
    result.otherRequests=await db.$queryRawUnsafe('SELECT session_id,status,command FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID');
    result.otherTransactions=await db.$queryRawUnsafe('SELECT s.session_id FROM sys.dm_tran_database_transactions d JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID');
  } catch { result.activityInspection='UNAVAILABLE'; }
}
main().catch(error=>{result.error=/^QA_[A-Z_]+$/.test(error?.message||'')?error.message:
  /^P\d+$/.test(error?.code||'')?error.code:'SQL_PREFLIGHT_FAILED';result.blockers.push(result.error);}).finally(async()=>{
  if(db)await db.$disconnect().catch(()=>undefined);
  // Permite conservar cada evidencia anterior durante una nueva ejecución QA.
  const destination=process.env.QA_BUYER_PREFLIGHT_OUTPUT
    ? path.resolve(process.env.QA_BUYER_PREFLIGHT_OUTPUT)
    : path.join(__dirname,'evidencias','comprobacion_previa.json');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,JSON.stringify(result,(_,v)=>typeof v==='bigint'?v.toString():v,2));
  console.log(JSON.stringify({target:result.target,blockers:result.blockers,compatibleStaffCount:result.compatibleStaffCount,
    missingColumns:result.missingColumns,launcherLiteralCompatible:result.configuration?.launcherLiteralCompatible}));
  // Conexión de lectura lograda no equivale a prerrequisitos completos.
  process.exitCode=result.error?1:result.blockers.length?2:0;
});
