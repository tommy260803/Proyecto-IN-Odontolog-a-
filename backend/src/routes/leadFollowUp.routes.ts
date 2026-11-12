import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { leadOperationalPriority } from '../services/leadOperationalPriority';
import { buildLeadFollowUpMessage } from '../services/leadFollowUpMessage';
import { readWhatsAppTracking, whatsappFollowUpSuggestion } from '../services/leadWhatsAppTracking';
import { leadStaffAuthEnabled, getLeadStaffIdentity } from '../services/leadStaffAuth';
export const leadFollowUpRouter = Router();
leadFollowUpRouter.use(async (req,res,next) => {
  if (req.path.startsWith('/connector/')) return next();
  if (!leadStaffAuthEnabled()) return next();
  try {
    const user = await getLeadStaffIdentity(req,prisma);
    if (!user) return res.status(401).json({ error:'Se requiere sesión del personal.' });
    const match=req.path.match(/^\/(\d+)(?:\/|$)/);
    if (match) {
      const row = await prisma.solicitudes.findUnique({ where:{ id_solicitud:Number(match[1]) } });
      if (user.rol!=='Administrador' && row?.id_negociador!==user.id_usuario) return res.sendStatus(403);
    }
    return next();
  } catch { return res.sendStatus(401); }
});
type State = { estado: string; motivo: string; borrador: string | null; clave_envio: string | null; revision: number; ultimo_envio_utc: Date | null };

leadFollowUpRouter.use('/connector', (req,res,next) => {
  const key=process.env.LEAD_FOLLOWUP_CONNECTOR_TOKEN;
  if (!key || req.get('Authorization')!=='Bearer '+key) return res.sendStatus(401);
  return next();
});
leadFollowUpRouter.get('/connector/pending',async (_req,res) => {
  try {
    if (!await installed(prisma)) return res.status(409).json({error:'Esquema de seguimiento pendiente.'});
    const messages=await prisma.$queryRaw`
      SELECT f.id_solicitud,f.clave_envio,f.borrador,p.numero AS destinatario
      FROM dbo.SeguimientoOperativoLead f
      JOIN dbo.Solicitudes s ON s.id_solicitud=f.id_solicitud
      JOIN dbo.Personas p ON p.id_persona=s.id_persona
      JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual AND e.nombre='LEAD'
      WHERE f.estado='PREPARADO' AND s.fecha_proximo_seguimiento<=SYSUTCDATETIME()
        AND p.autoriza_contacto=1 AND NULLIF(p.numero,'') IS NOT NULL
        AND s.archivada_lead_en IS NULL AND s.estado IN ('Abierta','En negociación')
        AND ISNULL(s.resultado_comercial_lead,'PENDIENTE')='PENDIENTE'
      ORDER BY s.fecha_proximo_seguimiento,s.id_solicitud
    `;
    res.set('Cache-Control','no-store').json(messages);
  } catch {res.status(500).json({error:'No se pudo consultar la cola.'});}
});
leadFollowUpRouter.post('/connector/result',async(req,res)=>{
  const {clave_envio,estado,id_externo}=req.body;
  if(typeof clave_envio!=='string'||!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(clave_envio)||
    !['ENVIADO','FALLIDO'].includes(estado)||typeof id_externo!=='string'||!id_externo.trim()||id_externo.length>200) return res.sendStatus(400);
  try {
    await prisma.$transaction(async tx=>{
      const [old]=await tx.$queryRaw<{id_solicitud:number;estado:string;id_externo:string|null;revision:number}[]>`
        SELECT id_solicitud,estado,id_externo,revision FROM dbo.SeguimientoOperativoLead WITH (UPDLOCK,HOLDLOCK)
        WHERE clave_envio=CONVERT(uniqueidentifier,${clave_envio})
      `;
      if(!old)throw new Error('Clave de envío inexistente.');
      if(old.estado===estado&&old.id_externo===id_externo)return;
      if(!['PREPARADO','FALLIDO'].includes(old.estado))throw new Error('El envío ya fue confirmado o cancelado.');
      await tx.$executeRaw`
        UPDATE dbo.SeguimientoOperativoLead SET estado=${estado},id_externo=${id_externo},
          ultimo_envio_utc=CASE WHEN ${estado}='ENVIADO' THEN SYSUTCDATETIME() ELSE ultimo_envio_utc END,
          revision=revision+1,actualizado_utc=SYSUTCDATETIME()
        WHERE id_solicitud=${old.id_solicitud};
        INSERT dbo.HistorialSeguimientoOperativoLead(id_solicitud,estado,motivo,borrador,revision)
        SELECT id_solicitud,estado,'Resultado del conector',borrador,revision FROM dbo.SeguimientoOperativoLead WHERE id_solicitud=${old.id_solicitud};
      `;
      if(estado==='ENVIADO')await tx.solicitudes.updateMany({where:{id_solicitud:old.id_solicitud},data:{fecha_proximo_seguimiento:null}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    res.json({ok:true});
  }catch(error){res.status(409).json({error:error instanceof Error?error.message:'No se pudo confirmar el envío.'});}
});

async function installed(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ ok: number }[]>`SELECT CASE WHEN OBJECT_ID('dbo.SeguimientoOperativoLead','U') IS NULL THEN 0 ELSE 1 END AS ok`;
  return row.ok === 1;
}
leadFollowUpRouter.get('/priorities', async (_req, res) => {
  try {
    const rows = await prisma.solicitudes.findMany({
      where: { archivada_lead_en: null, Persona: { Etapa: { nombre: 'LEAD' } } }, orderBy: { fecha_solicitud: 'asc' },
    });
    const states = await installed(prisma) ? await prisma.$queryRaw<{ id_solicitud: number; estado: string }[]>`SELECT id_solicitud,estado FROM dbo.SeguimientoOperativoLead` : [];
    res.set('Cache-Control','no-store').json(rows.map(row => ({
      id_persona: row.id_persona, id_solicitud: row.id_solicitud, fecha: row.fecha_proximo_seguimiento,
      ...leadOperationalPriority({ active: ['Abierta','En negociación'].includes(row.estado) && !['ACEPTADA','CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? ''),
        followUp: row.fecha_proximo_seguimiento, firstResponse: row.fecha_primera_respuesta,
        paused: states.find(s => s.id_solicitud === row.id_solicitud)?.estado === 'PAUSADO' }),
    })).sort((a,b) => a.orden-b.orden));
  } catch { res.status(500).json({ error: 'No se pudo consultar la prioridad.' }); }
});
leadFollowUpRouter.get('/:id', async (req,res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(400);
    const row = await prisma.solicitudes.findUnique({ where: { id_solicitud: id }, include: { Persona: { include: { Etapa: true } } } });
    if (!row) return res.sendStatus(404);
    const ready = await installed(prisma);
    const [state] = ready ? await prisma.$queryRaw<State[]>`SELECT * FROM dbo.SeguimientoOperativoLead WHERE id_solicitud=${id}` : [];
    const [whatsapp] = await readWhatsAppTracking(prisma, id);
    const canSuggest = row.Persona.Etapa.nombre === 'LEAD' && ['Abierta', 'En negociación'].includes(row.estado) && !row.archivada_lead_en &&
      !['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '') && state?.estado !== 'PAUSADO' &&
      state?.estado !== 'CANCELADO' && state?.estado !== 'ENVIADO' && !row.fecha_proximo_seguimiento;
    res.set('Cache-Control','no-store').json({ instalado: ready, seguimiento: state ?? null, fecha: row.fecha_proximo_seguimiento,
      whatsapp, sugerencia_whatsapp: canSuggest ? whatsappFollowUpSuggestion(whatsapp) : null });
  } catch { res.status(500).json({ error: 'No se pudo consultar el seguimiento.' }); }
});
leadFollowUpRouter.post('/:id', async (req,res) => {
  try {
    const id = Number(req.params.id);
    const { accion,motivo,revision,fecha_lima } = req.body;
    if (!Number.isSafeInteger(id) || id < 1 || !['programar','pausar','cancelar','preparar','actualizar_mensaje'].includes(accion) ||
        typeof motivo !== 'string' || !motivo.trim() || motivo.length>400 || !Number.isSafeInteger(revision)) return res.status(400).json({ error: 'Indica acción, motivo y revisión válidos.' });
    const result = await prisma.$transaction(async tx => {
      if (!await installed(tx)) throw new Error('Requiere instalar 10_SEGUIMIENTO_OPERATIVO_LEAD.sql.');
      const row = await tx.solicitudes.findUnique({ where: { id_solicitud: id }, include: { Persona: { include: { Etapa: true } }, Servicio: true } });
      if (!row || row.Persona.Etapa.nombre!=='LEAD' || row.archivada_lead_en || !['Abierta','En negociación'].includes(row.estado) ||
          ['ACEPTADA','CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? '')) throw new Error('La negociación ya no admite seguimiento.');
      const [old] = await tx.$queryRaw<State[]>`SELECT * FROM dbo.SeguimientoOperativoLead WITH (UPDLOCK,HOLDLOCK) WHERE id_solicitud=${id}`;
      if ((old?.revision ?? 0)!==revision) throw new Error('El seguimiento cambió. Actualiza antes de guardar.');
      let state = accion==='pausar' ? 'PAUSADO' : accion==='cancelar' ? 'CANCELADO' : 'PROGRAMADO';
      let draft: string | null = null;
      let key: string | null = null;
      if (accion==='programar') {
        if (typeof fecha_lima!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha_lima)) throw new Error('Indica fecha y hora de Lima.');
        const date = new Date(fecha_lima+':00-05:00');
        if (!Number.isFinite(date.getTime()) || date<=new Date() ||
            new Date(date.getTime()-5*3600000).toISOString().slice(0,16)!==fecha_lima) throw new Error('Elige una fecha futura válida.');
        await tx.solicitudes.updateMany({ where: { id_solicitud: id },data: { fecha_proximo_seguimiento: date } });
      }
      if (accion==='cancelar') await tx.solicitudes.updateMany({ where: { id_solicitud: id },data: { fecha_proximo_seguimiento: null } });
      if (accion==='preparar' || accion==='actualizar_mensaje') {
        if (accion==='actualizar_mensaje' && old?.estado!=='PREPARADO') throw new Error('Solo se puede actualizar un mensaje preparado y todavía no enviado.');
        if (old?.estado==='PAUSADO') throw new Error('Reprograma para reanudar el seguimiento.');
        if (!row.Persona.autoriza_contacto || !row.Persona.numero) throw new Error('Falta autorización de contacto o teléfono.');
        if (!row.fecha_proximo_seguimiento) throw new Error('Programa primero el seguimiento.');
        if (accion==='preparar' && old?.estado==='PREPARADO' && old.borrador) return { reutilizado: true };
        const hours = Number(process.env.LEAD_FOLLOWUP_MIN_HOURS);
        if (old?.ultimo_envio_utc && (!Number.isFinite(hours) || hours<=0 || Date.now()-old.ultimo_envio_utc.getTime()<hours*3600000)) throw new Error('Revisa la frecuencia de contacto permitida.');
        const replies = await tx.interacciones.findMany({
          where: { id_solicitud:id, tipo:'Respuesta del paciente', mensaje:{not:null} },
          orderBy:[{fecha_hora:'desc'},{id_interaccion:'desc'}],take:2,select:{mensaje:true,fecha_hora:true},
        });
        const proposals = await tx.$queryRaw<{id:number;price:string;expiresAt:Date}[]>`
          SELECT p.id_propuesta AS id, CONVERT(varchar(30),p.precio_cotizado) AS price,
            p.fecha_vigencia_hasta_utc_lead AS expiresAt
          FROM dbo.PropuestasEconomicasLead p
          WHERE p.id_solicitud=${id} AND p.id_servicio=${row.id_servicio} AND p.estado='Pendiente'
            AND p.fecha_vigencia_hasta_utc_lead>SYSUTCDATETIME()
            AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead v
              WHERE COALESCE(v.id_propuesta_raiz,v.id_propuesta)=COALESCE(p.id_propuesta_raiz,p.id_propuesta)
                AND v.numero_version>p.numero_version)
          ORDER BY p.fecha_presentacion DESC,p.id_propuesta DESC
        `;
        const [whatsapp] = await readWhatsAppTracking(tx, id);
        const unanswered = whatsapp?.contacto_permitido && !whatsapp.primera_respuesta_utc &&
          !replies.some(reply => reply.fecha_hora >= whatsapp.enviada_utc);
        const whatsappStatus = unanswered && (whatsapp.lectura_detectada_utc ? 'read' : whatsapp.entrega_detectada_utc ? 'delivered' : undefined);
        draft = buildLeadFollowUpMessage({name:row.Persona.nombres,service:row.Servicio?.nombre??'atención',
          contactAt:row.fecha_proximo_seguimiento,now:new Date(),replies:replies.map(r=>r.mensaje??''),
          proposals: whatsappStatus ? proposals.filter(proposal => proposal.id === whatsapp.id_propuesta) : proposals,
          whatsappStatus: whatsappStatus || undefined });
        key=old?.estado==='FALLIDO' && old.clave_envio ? old.clave_envio : randomUUID();
        if(old?.estado==='FALLIDO' && old.borrador)draft=old.borrador;
        state='PREPARADO';
      }
      const next=revision+1;
      await tx.$executeRaw`
        MERGE dbo.SeguimientoOperativoLead WITH (HOLDLOCK) AS t
        USING (SELECT ${id} AS id_solicitud) s ON t.id_solicitud=s.id_solicitud
        WHEN MATCHED THEN UPDATE SET estado=${state},motivo=${motivo.trim()},borrador=${draft},clave_envio=CONVERT(uniqueidentifier,CONVERT(varchar(36),${key})),revision=${next},actualizado_utc=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT(id_solicitud,estado,motivo,borrador,clave_envio,revision) VALUES(${id},${state},${motivo.trim()},${draft},CONVERT(uniqueidentifier,CONVERT(varchar(36),${key})),${next});
      `;
      await tx.$executeRaw`INSERT dbo.HistorialSeguimientoOperativoLead(id_solicitud,estado,motivo,borrador,revision) VALUES(${id},${state},${motivo.trim()},${draft},${next})`;
      return { estado:state };
    },{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json(result);
  } catch(error) { res.status(409).json({ error:error instanceof Error ? error.message : 'No se pudo guardar el seguimiento.' }); }
});
