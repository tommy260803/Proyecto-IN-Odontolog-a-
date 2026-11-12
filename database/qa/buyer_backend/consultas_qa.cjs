// Todas estas consultas se ejecutan contra Prisma y SQL Server reales.
async function inspect(db) {
  const [identity] = await db.$queryRawUnsafe("SELECT CAST(@@SERVERNAME AS nvarchar(128)) servidor,DB_NAME() base,SYSUTCDATETIME() utc");
  if (identity.servidor !== 'DANIELPC' || identity.base !== 'NexoSalud_LeadEnsayoFinal') throw Error('QA_DESTINATION_EFFECTIVE_BLOCKED');
  const active = await db.$queryRawUnsafe('SELECT session_id,status,command FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID');
  const transactions = await db.$queryRawUnsafe('SELECT s.session_id FROM sys.dm_tran_database_transactions d JOIN sys.dm_tran_session_transactions s ON s.transaction_id=d.transaction_id WHERE d.database_id=DB_ID() AND s.session_id<>@@SPID');
  if (active.length || transactions.length) throw Error('QA_OTHER_ACTIVE_SESSION');
  const modules = await db.$queryRawUnsafe("SELECT OBJECT_NAME(object_id) nombre,CONVERT(varchar(64),HASHBYTES('SHA2_256',definition),2) sha256 FROM sys.sql_modules WHERE object_id IN(OBJECT_ID('dbo.usp_ConvertirBuyerALead'),OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead'),OBJECT_ID('dbo.v_DatosCaptacionBuyer')) ORDER BY nombre");
  const expected = { usp_ConvertirBuyerALead: '6A42F2ADD1BE9F827074A50A6DCB579C6341F71C35E8F0216E4E04A70DC634A5',
    usp_RegistrarEntradaAgenteLead: '280708E81E3BE607A3772F082961EBE6E8371C1698414F3FDAC8B82D8A0C087E',
    v_DatosCaptacionBuyer: 'BAC8AB4A8AF43E8FB98BFABFE29FA8DC4F4D17F42CB5389EDEF23844EE85665D' };
  if (modules.length !== 3 || modules.some(m => m.sha256 !== expected[m.nombre])) throw Error('QA_SQL_MODULE_DRIFT');
  const stages = await db.etapas.findMany({ where: { nombre: { in: ['BUYER', 'LEAD', 'PAYER'] } } });
  if (stages.length !== 3) throw Error('QA_REQUIRED_STAGES_MISSING');
  const service = await db.servicios.findFirst({ where: { activo: true }, orderBy: { id_servicio: 'asc' } });
  if (!service) throw Error('QA_ACTIVE_SERVICE_MISSING');
  const columns = await db.$queryRawUnsafe("SELECT c.name,ty.name tipo,c.max_length FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.DecisionesIA') ORDER BY c.column_id");
  return { identity, active, transactions, modules, stages, service, decisionColumns: columns };
}
async function subject(db, email) {
  const p = await db.personas.findFirst({ where: { email }, include: { Etapa: true } });
  if (!p) return null;
  const id = p.id_persona;
  const captures = await db.$queryRaw`SELECT * FROM dbo.CaptacionesBuyer WHERE id_persona=${id} ORDER BY id_captacion`;
  const interactions = await db.interacciones.findMany({ where: { id_persona: id }, orderBy: { id_interaccion: 'asc' } });
  const decisions = await db.decisionesIA.findMany({ where: { id_persona: id }, orderBy: { id_decision: 'asc' } });
  const requests = await db.solicitudes.findMany({ where: { id_persona: id }, orderBy: { id_solicitud: 'asc' } });
  const events = await db.$queryRaw`SELECT * FROM dbo.EventosEtapa WHERE id_persona=${id} ORDER BY id_evento_etapa`;
  const intake = await db.$queryRaw`SELECT * FROM dbo.EntradasAgenteLead WHERE id_persona=${id} ORDER BY id_solicitud`;
  return { person: p, captures, interactions, decisions, requests, events, intake };
}
async function snapshot(db, prefix) {
  const tables = [['Personas','id_persona'],['CaptacionesBuyer','id_captacion'],['Interacciones','id_interaccion'],
    ['DecisionesIA','id_decision'],['Solicitudes','id_solicitud'],['EventosEtapa','id_evento_etapa'],['EntradasAgenteLead','id_solicitud'],['PersonaPreferencias','id_preferencia']];
  const rows = [];
  for (const [table, key] of tables) {
    const sub = table === 'Personas' ? 'LEFT(t.nombres,LEN(@P1))=@P1'
      : 'EXISTS(SELECT 1 FROM dbo.Personas p WHERE p.id_persona=t.id_persona AND LEFT(p.nombres,LEN(@P1))=@P1)';
    const [r] = await db.$queryRawUnsafe(`SELECT (SELECT COUNT_BIG(*) FROM dbo.${table}) total,
      (SELECT COUNT_BIG(*) FROM dbo.${table} t WHERE ${sub}) sinteticos,
      CONVERT(varchar(64),HASHBYTES('SHA2_256',(SELECT t.* FROM dbo.${table} t WHERE NOT(${sub}) ORDER BY t.${key} FOR JSON PATH,INCLUDE_NULL_VALUES)),2) sha256_fuera_prefijo`, prefix);
    rows.push({ table, ...r });
  }
  const other = await db.$queryRawUnsafe('SELECT (SELECT COUNT_BIG(*) FROM dbo.Opciones) opciones,(SELECT COUNT_BIG(*) FROM dbo.Reservas) reservas,(SELECT COUNT_BIG(*) FROM dbo.PropuestasEconomicasLead) propuestas,(SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped=0) objetos');
  return { rows, other };
}
module.exports = { inspect, subject, snapshot };
