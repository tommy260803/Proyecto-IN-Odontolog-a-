import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../db';
import { BuyerEvaluationService } from './buyerEvaluationService';
import { classifyBuyerMessage, redactBuyerConversationText } from './buyerMessageClassifier';
import { registerLeadIntake, type LeadIntake } from './leadIntake';
import type { BuyerClassificationResult, BuyerConversationContext, BuyerEvaluationOutcome } from '../types/buyer';

const AGENT = 'BUYER_CHAT';
const EXECUTION_TTL_MS = 60_000;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// entrada es VARCHAR(MAX): escapes ASCII preservan texto exacto aun sin collation UTF-8.
export const encodeChat = (value: unknown) => JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
type Role = BuyerConversationContext['history'][number]['role'];
type Message = { role: Role; text: string; origin: string; at: string; actorId?: number };
interface Header { kind: 'conversation'; version: 1; conversationId: string }
interface Turn {
  kind: 'turn'; version: 1; conversationId: string; keyHash: string; contentHash: string;
  status: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADA'; interactionId: number;
  messages: Message[]; attempts: Array<{ at: string; result: string; errorCode?: string; executionId?: string }>;
  execution?: { id: string; expiresAt: string };
  proposal?: BuyerClassificationResult; evaluation?: BuyerEvaluationOutcome;
  modelProposal?: BuyerClassificationResult;
  declaredServiceId?: number | null;
  proposalContextHash?: string;
  validationNotice?: string;
  confirmation?: { serviceId: number; question: string };
}
type Row = { id_decision: number; id_interaccion: number | null; entrada: string | null };
export class BuyerChatError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const fail = (status: number, code: string, message: string): never => { throw new BuyerChatError(status, code, message); };
const parse = (row: Row): Header | Turn => JSON.parse(row.entrada || '{}');
export const validConversationId = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(s);
const affirmative = (text: string) => /^(?:s[ií]|s[ií],? por favor|de acuerdo|confirmo|ok)[.!\s]*$/i.test(text.trim());
const greeting = (text: string) => /^(?:hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|gracias)[.!\s]*$/i.test(text.trim());
type Evaluate = typeof BuyerEvaluationService.evaluateBuyerInteraction;
type Classify = typeof classifyBuyerMessage;
class ExecutionLost extends BuyerChatError {
  constructor() { super(409, 'EXECUTION_LOST', 'La ejecución venció o fue sustituida; consulta el turno vigente.'); }
}

/** SQL/Prisma reales por defecto. Las únicas inyecciones son costuras de pruebas unitarias. */
export class BuyerConversationService {
  constructor(private db: PrismaClient = prisma, private classify: Classify = classifyBuyerMessage,
    private evaluate: Evaluate = input => BuyerEvaluationService.evaluateBuyerInteraction(input)) {}

  private async locked<T>(personId: number, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // Lecturas bajo application lock usan ReadCommitted: no conservar snapshot previo a esperar.
    return this.db.$transaction(async tx => {
      const resource = `BuyerChat:${personId}`;
      const [lock] = await tx.$queryRaw<Array<{ result: number }>>`
        DECLARE @r int;
        EXEC @r=sys.sp_getapplock @Resource=${resource},@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=4000;
        SELECT @r result;
      `;
      if (!lock || lock.result < 0) fail(503, 'CHAT_BUSY', 'Conversación ocupada; reintenta con la misma clave.');
      return action(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  private async rows(db: Prisma.TransactionClient, personId: number, conversationId?: string): Promise<Row[]> {
    return db.decisionesIA.findMany({ where: { agente: AGENT, id_persona: personId,
      ...(conversationId ? { entrada: { contains: `"conversationId":"${conversationId}"` } } : {}) },
      orderBy: { id_decision: 'asc' } });
  }
  private requireConversation(rows: Row[], id: string) {
    if (!rows.some(r => { const p = parse(r); return p.kind === 'conversation' && p.conversationId === id; })) {
      fail(404, 'CONVERSATION_NOT_FOUND', 'Conversación no encontrada para esta persona.');
    }
  }
  private async save(db: Prisma.TransactionClient, rowId: number, turn: Turn) {
    await db.decisionesIA.update({ where: { id_decision: rowId }, data: {
      entrada: encodeChat(turn), decision: JSON.stringify({ estado: turn.status, version: 1 }),
      accion: 'CHAT_' + turn.status, requiere_revision: false,
    } });
  }
  private async sqlNow(db: Prisma.TransactionClient): Promise<Date> {
    const [clock] = await db.$queryRaw<Array<{ now_utc: Date }>>`SELECT SYSUTCDATETIME() AS now_utc`;
    if (!clock?.now_utc || !Number.isFinite(new Date(clock.now_utc).getTime())) throw new Error('SQL_CLOCK_UNAVAILABLE');
    return new Date(clock.now_utc);
  }
  private async fenced<T>(personId: number, rowId: number, executionId: string,
    action: (tx: Prisma.TransactionClient, owned: Turn) => Promise<T>): Promise<T> {
    return this.locked(personId, async tx => {
      const row = await tx.decisionesIA.findFirst({ where: { agente: AGENT, id_persona: personId, id_decision: rowId } });
      const now = await this.sqlNow(tx);
      const owned = row ? parse(row) as Turn : null;
      const expiry = new Date(owned?.execution?.expiresAt || '').getTime();
      if (!owned || owned.kind !== 'turn' || owned.status !== 'PROCESANDO' || owned.execution?.id !== executionId ||
        !Number.isFinite(expiry) || expiry <= now.getTime()) throw new ExecutionLost();
      owned.execution.expiresAt = new Date(now.getTime() + EXECUTION_TTL_MS).toISOString();
      await this.save(tx, rowId, owned);
      // El chequeo de identidad y la operación SQL son atómicos bajo el mismo lock.
      // Cada operación termina su transacción; ninguna espera a Gemini.
      return action(tx, owned);
    });
  }
  private async saveOwned(personId: number, rowId: number, executionId: string, turn: Turn) {
    return this.fenced(personId, rowId, executionId, async (tx, owned) => {
      turn.execution = owned.execution;
      await this.save(tx, rowId, turn);
    });
  }
  private async intakeOutsideTransaction(personId: number, rowId: number, executionId: string, requestId: number) {
    // El receptor real rechaza @@TRANCOUNT<>0 (54702). Un único batch mantiene
    // el MISMO applock por sesión, verifica el lease en SQL y ejecuta el SP sin
    // transacción envolvente. No se libera el lock entre validación y efecto.
    // El procedimiento conserva su propia transacción e idempotencia.
    const resource = `BuyerChat:${personId}`;
    try {
      return await this.db.$queryRaw<LeadIntake[]>`
        /* CHAT_INTAKE_SESSION_FENCE */
        SET NOCOUNT ON;
        DECLARE @request int=${requestId}, @person int=${personId}, @turn int=${rowId};
        DECLARE @execution nvarchar(36)=${executionId}, @resource nvarchar(255)=${resource};
        DECLARE @lock int, @release int, @held bit=0;
        IF @@TRANCOUNT <> 0 THROW 51209, 'CHAT_INTAKE_REQUIRES_AUTOCOMMIT', 1;
        BEGIN TRY
          EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode=N'Exclusive',@LockOwner=N'Session',@LockTimeout=4000;
          IF @lock < 0 THROW 51209, 'CHAT_INTAKE_LOCK_FAILED', 1;
          SET @held=1;
          IF NOT EXISTS (
            SELECT 1 FROM dbo.DecisionesIA d JOIN dbo.Interacciones i ON i.id_interaccion=d.id_interaccion
            WHERE d.id_decision=@turn AND d.id_persona=@person AND d.agente='BUYER_CHAT'
              AND i.id_persona=@person AND i.id_solicitud=@request
              AND JSON_VALUE(d.entrada,'$.kind')='turn'
              AND JSON_VALUE(d.entrada,'$.status')='PROCESANDO'
              AND JSON_VALUE(d.entrada,'$.execution.id')=@execution
              AND TRY_CONVERT(datetime2(7),JSON_VALUE(d.entrada,'$.execution.expiresAt'),127)>SYSUTCDATETIME()
          ) THROW 51208, 'CHAT_EXECUTION_LOST', 1;
          EXEC dbo.usp_RegistrarEntradaAgenteLead @id_solicitud=@request;
          EXEC @release=sys.sp_releaseapplock @Resource=@resource,@LockOwner=N'Session';
          SET @held=0;
        END TRY
        BEGIN CATCH
          IF @held=1 EXEC @release=sys.sp_releaseapplock @Resource=@resource,@LockOwner=N'Session';
          THROW;
        END CATCH;
      `;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && String(error.meta?.code) === '51208') throw new ExecutionLost();
      throw error;
    }
  }
  private executionDb(personId: number, rowId: number, executionId: string): PrismaClient {
    const guarded: any = {};
    for (const model of ['personas','servicios','personaPreferencias','horarios','interacciones','decisionesIA','solicitudes']) {
      guarded[model] = {};
      for (const method of ['findUnique','findFirst','findMany','create','update','updateMany']) {
        guarded[model][method] = (...args: any[]) => this.fenced(personId, rowId, executionId,
          tx => (tx as any)[model][method](...args));
      }
    }
    for (const method of ['$queryRaw','$executeRaw']) guarded[method] = (...args: any[]) => {
      // Excepción estricta para el template interno de leadIntake; no habilita
      // SQL arbitrario ni deja pasar otras consultas sin fencing transaccional.
      if (method === '$queryRaw' && Array.isArray(args[0]) && args.length === 2 &&
        /^\s*EXEC dbo\.usp_RegistrarEntradaAgenteLead\s+@id_solicitud\s*=\s*\?\s*$/i.test(args[0].join('?')) &&
        Number.isSafeInteger(args[1]) && args[1] > 0) {
        return this.intakeOutsideTransaction(personId, rowId, executionId, args[1]);
      }
      return this.fenced(personId, rowId, executionId, tx => (tx as any)[method](...args));
    };
    return guarded;
  }
  private view(rowId: number, turn: Turn, now?: Date) {
    const expired = Boolean(now && turn.execution && new Date(turn.execution.expiresAt).getTime() <= now.getTime());
    return { conversationId: turn.conversationId, turnId: rowId, interactionId: turn.interactionId,
      status: turn.status, messages: turn.messages, attempts: turn.attempts,
      declaredServiceId: turn.declaredServiceId ?? null,
      analysis: turn.modelProposal?.conversation ? {
        intention: turn.modelProposal.intencion, interpretedServiceId: turn.modelProposal.id_servicio,
        pendingData: turn.modelProposal.conversation.datos_pendientes,
        contradictions: turn.modelProposal.conversation.contradicciones,
        proposedAction: turn.modelProposal.conversation.accion_propuesta,
      } : null,
      evaluation: turn.evaluation || null, execution: turn.execution || null,
      retryable: turn.status === 'PENDIENTE' || (turn.status === 'PROCESANDO' && expired) || this.deliveryPending(turn) };
  }

  private deliveryPending(turn: Turn) {
    return turn.status === 'COMPLETADA' && turn.evaluation?.accion === 'CONVERSION_LEAD' &&
      turn.evaluation.entregaLeadEstado === 'PENDIENTE';
  }

  async list(personId: number, after = 0, limit = 20) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
      fail(400, 'INVALID_PAGE', 'Cursor o límite de página inválido.');
    }
    const headers = await this.db.decisionesIA.findMany({ where: { agente: AGENT, id_persona: personId,
      id_decision: { gt: after }, entrada: { contains: '"kind":"conversation"' } }, orderBy: { id_decision: 'asc' }, take: limit + 1 });
    const now = await this.sqlNow(this.db);
    const items = [];
    for (const header of headers.slice(0, limit)) {
      const conversation = parse(header) as Header;
      const latest = await this.db.decisionesIA.findFirst({ where: { agente: AGENT, id_persona: personId,
        entrada: { contains: `"conversationId":"${conversation.conversationId}"` }, NOT: { id_interaccion: null } }, orderBy: { id_decision: 'desc' } });
      const turn = latest ? parse(latest) as Turn : null;
      items.push({ conversationId: conversation.conversationId, status: turn?.status || 'VACIA',
        lastTurnId: latest?.id_decision || null, lastAction: turn?.evaluation?.accion || null,
        retryable: turn ? this.view(latest!.id_decision, turn, now).retryable : false });
    }
    return { personId, items, nextAfter: headers.length > limit ? headers[limit - 1].id_decision : null };
  }

  async history(personId: number, conversationId: string, after = 0) {
    if (!validConversationId(conversationId)) fail(400, 'INVALID_CONVERSATION', 'Identificador de conversación inválido.');
    const rows = await this.rows(this.db, personId, conversationId);
    this.requireConversation(rows, conversationId);
    const turns = rows.filter(r => parse(r).kind === 'turn' && r.id_decision > after);
    const now = await this.sqlNow(this.db);
    const page = turns.slice(0, 100);
    return { conversationId, personId, turns: page.map(r => this.view(r.id_decision, parse(r) as Turn, now)),
      nextAfter: turns.length > 100 ? page[page.length - 1].id_decision : null };
  }

  async send(personId: number, actorId: number, key: string, input: {
    conversationId?: string; message: string; origin: 'OPERADOR' | 'OPERADOR_TRANSCRIPTOR';
  }) {
    if (!Number.isSafeInteger(actorId) || actorId < 1) fail(401, 'STAFF_REQUIRED', 'Identidad de operador requerida.');
    if (typeof key !== 'string' || !/^[\x21-\x7e]{8,128}$/.test(key)) fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key debe tener 8–128 caracteres ASCII sin espacios.');
    if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000 ||
      !['OPERADOR','OPERADOR_TRANSCRIPTOR'].includes(input.origin)) fail(400, 'INVALID_MESSAGE', 'Mensaje u origen inválido.');
    if (input.conversationId !== undefined && !validConversationId(input.conversationId)) fail(400, 'INVALID_CONVERSATION', 'Conversación inválida.');
    const keyHash = hash(key), contentHash = hash(encodeChat(input));
    const reserved = await this.locked(personId, async tx => {
      const person = await tx.personas.findUnique({ where: { id_persona: personId } });
      if (!person) return fail(404, 'PERSON_NOT_FOUND', 'Persona no encontrada.');
      const rows = await this.rows(tx, personId);
      const previous = rows.find(r => { const p = parse(r); return p.kind === 'turn' && p.keyHash === keyHash; });
      if (previous) {
        const p = parse(previous) as Turn;
        if (p.contentHash !== contentHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Clave utilizada con otro contenido o conversación.');
        return { rowId: previous.id_decision, turn: p, created: false };
      }
      const conversationId = input.conversationId || randomUUID();
      if (input.conversationId) this.requireConversation(rows, conversationId);
      const unfinished = rows.some(r => { const p = parse(r); return p.kind === 'turn' && p.status !== 'COMPLETADA'; });
      if (unfinished) fail(409, 'TURN_PENDING', 'Existe un turno pendiente para esta persona; consulta o reintenta ese turno.');
      const capture = await tx.$queryRaw<Array<{ id_captacion: number }>>`
        SELECT TOP (1) id_captacion FROM dbo.CaptacionesBuyer WHERE id_persona=${personId} ORDER BY id_captacion ASC
      `;
      if (!capture.length) fail(409, 'CAPTURE_REQUIRED', 'Falta captación Buyer; no se crea implícitamente.');
      if (!input.conversationId) await tx.decisionesIA.create({ data: { agente: AGENT, id_persona: personId,
        id_usuario: actorId, entrada: encodeChat({ kind: 'conversation', version: 1, conversationId } satisfies Header),
        accion: 'CHAT_CONVERSATION' } });
      const interaction = await tx.interacciones.create({ data: { id_persona: personId, id_usuario: actorId,
        tipo: 'BUYER_CHAT_ENTRADA', mensaje: input.message, fecha_hora: new Date() } });
      const turn: Turn = { kind: 'turn', version: 1, conversationId, keyHash, contentHash,
        status: 'PENDIENTE', interactionId: interaction.id_interaccion, attempts: [], messages: [{
          role: input.origin === 'OPERADOR_TRANSCRIPTOR' ? 'operador_transcriptor' : 'paciente',
          origin: input.origin, text: input.message, actorId, at: new Date().toISOString(),
        }] };
      const row = await tx.decisionesIA.create({ data: { agente: AGENT, id_persona: personId,
        id_usuario: actorId, id_captacion: capture[0].id_captacion, id_interaccion: interaction.id_interaccion,
        entrada: encodeChat(turn), accion: 'CHAT_PENDIENTE' } });
      return { rowId: row.id_decision, turn, created: true };
    });
    // Un replay no dispara trabajo técnico implícito; retry es una operación explícita.
    if (!reserved.created) return { ...this.view(reserved.rowId, reserved.turn), replayed: true };
    return this.process(personId, reserved.turn.conversationId, reserved.rowId);
  }

  async retry(personId: number, conversationId: string, turnId: number) {
    if (!validConversationId(conversationId)) fail(400, 'INVALID_CONVERSATION', 'Conversación inválida.');
    return this.process(personId, conversationId, turnId);
  }

  private async reconcile(db: PrismaClient, personId: number, captureId: number, interactionId: number, stage: string): Promise<BuyerEvaluationOutcome | null> {
    const interaction = await db.interacciones.findUnique({ where: { id_interaccion: interactionId } });
    const decision = await db.decisionesIA.findFirst({ where: { agente: 'BUYER', id_persona: personId,
      id_interaccion: interactionId }, orderBy: { id_decision: 'desc' } });
    const prior = JSON.parse(decision?.decision || '{}');
    const hasOperation = prior.operacion_id === `BUYER_LEAD:${captureId}:${interactionId}`;
    if (!interaction?.id_solicitud && !prior.id_solicitud && !hasOperation) return null;
    if (!decision || !interaction || interaction.id_persona !== personId) return fail(409, 'RECONCILIATION_REQUIRED', 'Evidencia de interacción incompleta; no se repite la conversión.');
    const events = await db.$queryRaw<Array<{ id_evento_etapa: number; id_solicitud: number; id_servicio: number; clave_operacion_buyer: string | null }>>`
      /* CHAT_RECONCILE: solo evidencia comercial de esta persona y captación */
      SELECT e.id_evento_etapa,e.id_solicitud,s.id_servicio,e.clave_operacion_buyer
      FROM dbo.EventosEtapa e JOIN dbo.Solicitudes s ON s.id_solicitud=e.id_solicitud AND s.id_persona=e.id_persona
      JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino
      WHERE e.id_persona=${personId} AND e.id_captacion=${captureId} AND eo.nombre='BUYER' AND ed.nombre='LEAD'
    `;
    const related = events.filter(e => interaction.id_solicitud === e.id_solicitud ||
      (prior.id_solicitud === e.id_solicitud && (!prior.id_evento_etapa || prior.id_evento_etapa === e.id_evento_etapa)) ||
      (hasOperation && (e.clave_operacion_buyer === `BUYER_LEAD:${captureId}` || e.clave_operacion_buyer === `BUYER_LEAD:${captureId}:${interactionId}`)));
    // Operación prevista, pero ningún efecto confirmado: el SP idempotente puede
    // reintentarse. La ejecución anterior ya está cercada por identidad/lock.
    if (!events.length && hasOperation && !interaction.id_solicitud && !prior.id_solicitud) return null;
    if (related.length !== 1) fail(409, 'RECONCILIATION_REQUIRED', 'Evento ausente o ambiguo; no se repite la conversión.');
    const event = related[0];
    if ((interaction.id_solicitud && interaction.id_solicitud !== event.id_solicitud) ||
      (prior.id_solicitud && prior.id_solicitud !== event.id_solicitud) ||
      await db.interacciones.findFirst({ where: { id_persona: personId, id_solicitud: event.id_solicitud, NOT: { id_interaccion: interactionId } } })) {
      fail(409, 'RECONCILIATION_REQUIRED', 'La conversión no pertenece exclusivamente a esta interacción.');
    }
    // Completar primero el vínculo ya demostrado por la evidencia anterior;
    // el receptor cercado exige que la solicitud pertenezca a este turno.
    await db.$executeRaw`UPDATE dbo.Interacciones SET id_solicitud=${event.id_solicitud}, resultado='Conversión reconciliada para el turno' WHERE id_interaccion=${interactionId}`;
    let delivery: BuyerEvaluationOutcome['entregaLeadEstado'] = 'PENDIENTE';
    try {
      const entry = await registerLeadIntake(event.id_solicitud, db);
      if (entry.id_solicitud === event.id_solicitud && entry.id_persona === personId && entry.id_evento_etapa === event.id_evento_etapa) delivery = 'CONFIRMADA';
    } catch (error) { if (error instanceof ExecutionLost) throw error; }
    const payload = { ...prior, estado: 'COMPLETADA', intencion: 'SOLICITA_RESERVA', id_servicio: event.id_servicio,
      id_solicitud: event.id_solicitud, id_evento_etapa: event.id_evento_etapa, entregaLeadEstado: delivery };
    await db.decisionesIA.update({ where: { id_decision: decision.id_decision }, data: {
      decision: JSON.stringify(payload), accion: 'CONVERSION_LEAD', requiere_revision: delivery !== 'CONFIRMADA',
      resultado_revision: 'Conversión reconciliada desde evidencia de la misma interacción; no se repitió el SP.',
    } });
    return { id_persona: personId, id_captacion: captureId, id_interaccion: interactionId, id_decision: decision.id_decision,
      estado: 'COMPLETADA', intencion: 'SOLICITA_RESERVA', id_servicio: event.id_servicio, accion: 'CONVERSION_LEAD',
      etapa_final: stage, id_solicitud: event.id_solicitud, id_evento_etapa: event.id_evento_etapa,
      entregaLeadEstado: delivery, ya_convertido: true, intentosRealizados: prior.intentosRealizados || 1,
      duracionTotalMs: prior.duracionTotalMs || 0, historial_errores: prior.historial_errores, contextFingerprint: prior.contextFingerprint };
  }

  private async process(personId: number, conversationId: string, rowId: number) {
    const claim = await this.locked(personId, async tx => {
      const rows = await this.rows(tx, personId, conversationId);
      this.requireConversation(rows, conversationId);
      const row = rows.find(r => r.id_decision === rowId && parse(r).kind === 'turn');
      if (!row) return fail(404, 'TURN_NOT_FOUND', 'Turno no encontrado en esta conversación/persona.');
      const turn = parse(row) as Turn;
      const now = await this.sqlNow(tx);
      // Retry explícito de entrega: reconciliar esta interacción, nunca volver
      // a clasificar ni atribuirle una conversión histórica de otra interacción.
      const deliveryPending = this.deliveryPending(turn);
      if (turn.status === 'COMPLETADA' && !deliveryPending) return { run: false, turn, rows, now };
      if (turn.status !== 'PROCESANDO' && turn.status !== 'PENDIENTE' && !deliveryPending) {
        fail(409, 'EXECUTION_UNVERIFIABLE', 'Estado de turno desconocido; no se reinicia automáticamente.');
      }
      if (turn.status === 'PROCESANDO') {
        const expiry = new Date(turn.execution?.expiresAt || '').getTime();
        if (!validConversationId(turn.execution?.id) || !Number.isFinite(expiry) ||
          new Date(expiry).toISOString() !== turn.execution?.expiresAt) {
          fail(409, 'EXECUTION_UNVERIFIABLE', 'Turno anterior sin identidad/vencimiento UTC verificables; requiere reconciliación supervisada.');
        }
        if (expiry > now.getTime()) return { run: false, turn, rows, now };
        const attempt = turn.attempts[turn.attempts.length - 1];
        if (attempt?.result === 'EN_CURSO') { attempt.result = 'INTERRUMPIDA'; attempt.errorCode = 'LEASE_EXPIRED'; }
      }
      const interaction = await tx.interacciones.findUnique({ where: { id_interaccion: turn.interactionId } });
      if (!interaction || interaction.id_persona !== personId) fail(409, 'BROKEN_TURN', 'Pertenencia de interacción inconsistente.');
      turn.status = 'PROCESANDO';
      turn.execution = { id: randomUUID(), expiresAt: new Date(now.getTime() + EXECUTION_TTL_MS).toISOString() };
      turn.attempts.push({ at: now.toISOString(), result: 'EN_CURSO', executionId: turn.execution.id });
      await this.save(tx, rowId, turn);
      return { run: true, turn, rows, now };
    });
    const turn = claim.turn;
    if (!claim.run) return { ...this.view(rowId, turn, claim.now), replayed: true };
    const executionId = turn.execution!.id;
    const db = this.executionDb(personId, rowId, executionId);
    // Se liberó el application lock y se hizo commit ANTES de cualquier llamada externa.
    try {
      const person = await db.personas.findUnique({ where: { id_persona: personId }, include: { Etapa: true } });
      if (!person) throw new Error('PERSON_NOT_FOUND');
      const [capture] = await db.$queryRaw<Array<{ id_captacion: number; id_servicio: number | null }>>`
        SELECT TOP (1) id_captacion,id_servicio FROM dbo.CaptacionesBuyer WHERE id_persona=${personId} ORDER BY id_captacion ASC
      `;
      if (!capture) throw new Error('CAPTURE_REQUIRED');
      const pref = await db.personaPreferencias.findFirst({ where: { id_persona: personId,
        OR: [{ fecha_fin: null }, { fecha_fin: { gt: new Date() } }] }, orderBy: { id_preferencia: 'desc' }, include: { Horario: true } });
      const declared = pref?.id_servicio_interes ?? capture.id_servicio ?? null;
      turn.declaredServiceId = declared;
      const minimize = (text: string) => {
        const identity = [person.dni, person.numero, person.email, person.nombres, person.apellidos,
          ...person.nombres.split(/\s+/), ...person.apellidos.split(/\s+/)];
        for (const value of identity) {
          if (value && value.length > 2) text = text.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[dato personal omitido]');
        }
        return redactBuyerConversationText(text);
      };
      const previous = claim.rows.filter(r => r.id_decision < rowId && parse(r).kind === 'turn')
        .map(r => parse(r) as Turn).filter(t => t.status === 'COMPLETADA').slice(-6);
      const last = previous[previous.length - 1];
      const lastAnswer = last ? [...last.messages].reverse().find(m => m.role === 'asistente') : undefined;
      const confirmed = last?.confirmation && lastAnswer?.text.endsWith(last.confirmation.question) ? last.confirmation.serviceId : null;
      const context: BuyerConversationContext = {
        history: previous.flatMap(t => t.messages).slice(-12).map(m => ({ role: m.role, text: minimize(m.text).slice(0, 500) })),
        preferences: { declaredServiceId: declared, branch: pref?.sede_preferida ? minimize(pref.sede_preferida).slice(0, 150) : null,
          schedule: pref?.Horario ? `${pref.Horario.hora_inicio.toISOString().slice(11,16)}-${pref.Horario.hora_fin.toISOString().slice(11,16)}` : null,
          source: pref ? 'PersonaPreferencias vigente; servicio de captación solo si no informado' : 'CaptacionesBuyer; sede y horario no informados' },
        facts: ['Catálogo activo de servicios; sin precios ni disponibilidad autorizados.'], confirmationServiceId: confirmed || null,
        confirmationQuestion: confirmed && last?.confirmation ? minimize(last.confirmation.question).slice(0,500) : null,
      };
      const message = turn.messages[0].text;
      const recovered = await this.reconcile(db, personId, capture.id_captacion, turn.interactionId, person.Etapa.nombre);
      const outcome = recovered || await this.evaluate({ id_persona: personId, id_interaccion: turn.interactionId,
        id_captacion: capture.id_captacion, mensaje: message, id_servicio_declarado: declared,
        conversationTurnId: rowId,
        conversationExecutionId: executionId,
        sede_preferida: pref?.sede_preferida ?? null, pref_id_horario: pref?.id_horario ?? null,
        dbClient: db, classifierOverride: async (_message, catalog) => {
          const contextHash = hash(encodeChat({ context, catalog: catalog.map(s => ({ id: s.id_servicio, name: s.nombre })) }));
          if (turn.proposalContextHash !== contextHash) { turn.proposal = undefined; turn.modelProposal = undefined; }
          if (!turn.proposal) {
            turn.validationNotice = undefined;
            turn.proposal = await this.classify(minimize(message), catalog, { maxRetries: 0, conversationContext: context });
            if (!turn.proposal.conversation) throw new Error('CONVERSATION_OUTPUT_REQUIRED');
            turn.modelProposal = structuredClone(turn.proposal);
            const p = turn.proposal;
            const validConfirmation = affirmative(message) && confirmed && catalog.some(s => s.id_servicio === confirmed);
            // El monosílabo no basta. Contradicciones/datos pendientes bloquean SQL comercial.
            if (greeting(message) || (affirmative(message) && (!confirmed || !catalog.some(s => s.id_servicio === confirmed))) || p.conversation!.contradicciones.length ||
              p.conversation!.datos_pendientes.length || p.conversation!.accion_propuesta !== 'SOLICITAR_CONVERSION' ||
              (p.intencion === 'SOLICITA_RESERVA' && p.id_servicio === null && !validConfirmation)) {
              if (p.intencion === 'SOLICITA_RESERVA') {
                p.intencion = 'AMBIGUA';
                turn.validationNotice = 'Necesitamos aclarar tu intención antes de continuar. ¿Deseas información o solicitar una cita para un servicio específico?';
              }
              if (p.intencion === 'AMBIGUA') p.id_servicio = null;
            } else if (affirmative(message) && confirmed && catalog.some(s => s.id_servicio === confirmed)) {
              p.id_servicio = confirmed;
            }
            if (p.intencion === 'SOLICITA_RESERVA') {
              const historical = await db.$queryRaw<Array<{ id_solicitud: number }>>`
                SELECT TOP (1) id_solicitud FROM dbo.EventosEtapa
                WHERE id_captacion=${capture.id_captacion} AND id_solicitud IS NOT NULL ORDER BY id_evento_etapa ASC
              `;
              const linked = await db.interacciones.findUnique({ where: { id_interaccion: turn.interactionId } });
              if (historical.length && linked?.id_solicitud !== historical[0].id_solicitud) {
                p.intencion = 'AMBIGUA'; p.id_servicio = null;
                turn.validationNotice = 'Esta captación ya tiene una conversión anterior. ¿Deseas consultar sobre esa solicitud? No se atribuyó esa conversión al mensaje nuevo.';
              }
            }
            turn.proposalContextHash = contextHash;
            // Cache durable previo al SP: un retry técnico no repite Gemini si ya respondió.
            await this.saveOwned(personId, rowId, executionId, turn);
          }
          return turn.proposal;
        } });
      turn.evaluation = outcome;
      if (outcome.estado === 'PENDIENTE' || (!turn.proposal?.conversation && outcome.accion !== 'CONVERSION_LEAD')) throw new Error('EVALUATION_PENDING');
      const proposal = turn.proposal?.conversation;
      let text = proposal?.respuesta || '', origin = 'GEMINI';
      if (outcome.accion === 'CONVERSION_LEAD') {
        const linked = await db.interacciones.findUnique({ where: { id_interaccion: turn.interactionId } });
        if (!Number.isSafeInteger(outcome.id_solicitud) || !Number.isSafeInteger(outcome.id_evento_etapa) ||
          linked?.id_solicitud !== outcome.id_solicitud) throw new Error('CONVERSION_NOT_LINKED_TO_TURN');
        text = `La solicitud #${outcome.id_solicitud} fue convertida a LEAD. ` +
          (outcome.entregaLeadEstado === 'CONFIRMADA' ? 'Recepción por LEAD confirmada.' : 'La recepción por LEAD está pendiente.') +
          ' Esto no confirma una cita ni disponibilidad.';
        origin = 'BACKEND_RESULTADO';
      } else if (outcome.accion === 'REQUISITOS_INCOMPLETOS') {
        text = 'Faltan datos o autorización de contacto registrados para solicitar la conversión. No se creó una solicitud.'; origin = 'BACKEND_VALIDACION';
      } else if (outcome.accion === 'CONSERVA_ETAPA_POSTERIOR' || outcome.accion === 'SOLICITUD_PENDIENTE_APERTURA') {
        text = `Se conserva la etapa ${outcome.etapa_final}. Esta respuesta no confirma una nueva conversión ni reserva.`; origin = 'BACKEND_RESULTADO';
      } else if (outcome.accion === 'ACLARACION' && (outcome.discrepancia_horario?.detectada || turn.proposal?.intencion === 'SOLICITA_RESERVA')) {
        text = outcome.aclaracion || 'Necesitamos aclarar el servicio y las preferencias antes de continuar.'; origin = 'BACKEND_VALIDACION';
      } else if (outcome.accion === 'ACLARACION' && turn.validationNotice && !proposal?.contradicciones.length && !proposal?.datos_pendientes.length) {
        text = turn.validationNotice; origin = 'BACKEND_VALIDACION';
      } else if (affirmative(message) && !confirmed) {
        text = '¿Deseas información o solicitar una cita? Indica el servicio para poder continuar.'; origin = 'BACKEND_VALIDACION';
      } else if (outcome.accion === 'ACLARACION' && proposal && (proposal.contradicciones.length || proposal.datos_pendientes.length)) {
        if (proposal.contradicciones.length) {
          text = `Detectamos datos contradictorios en tu consulta: ${proposal.contradicciones.join('; ')}. ¿Podrías aclararnos cuál es tu preferencia antes de continuar?`;
        } else if (proposal.datos_pendientes.length) {
          const hasSede = proposal.datos_pendientes.some(d => /sede|sucursal|local/i.test(d));
          const hasHorario = proposal.datos_pendientes.some(d => /horario|turno|hora|fecha/i.test(d));
          if (hasSede && hasHorario) {
            text = 'Para coordinar tu solicitud de evaluación odontológica, ¿tienes alguna preferencia de sede (por ejemplo, Sede Central o California) o de horario de atención? Si no tienes preferencia, indícalo para registrar tu solicitud.';
          } else if (hasSede) {
            text = 'Para coordinar tu solicitud, ¿tienes alguna preferencia de sede? Si no tienes preferencia, indícalo para continuar.';
          } else if (hasHorario) {
            text = 'Para coordinar tu solicitud, ¿tienes algún horario de preferencia? Si no tienes preferencia, indícalo para continuar.';
          } else {
            text = `Para coordinar tu solicitud, necesitamos precisar: ${proposal.datos_pendientes.join(', ')}. ¿Podrías indicárnoslo?`;
          }
        } else {
          text = outcome.aclaracion || 'Necesitamos aclarar tu preferencia antes de continuar.';
        }
        origin = 'BACKEND_VALIDACION';
      }
      if (outcome.accion === 'ACLARACION' && proposal?.confirmar_servicio && !proposal.contradicciones.length && !proposal.datos_pendientes.length) {
        const service = await db.servicios.findFirst({ where: { activo: true, id_servicio: proposal.confirmar_servicio } });
        if (service) {
          const question = `¿Confirmas que deseas solicitar la conversión a LEAD para ${service.nombre}, sin confirmar todavía una reserva ni disponibilidad?`;
          text += '\n' + question;
          turn.confirmation = { serviceId: service.id_servicio, question };
          origin = 'GEMINI_Y_BACKEND';
        }
      }
      // Actualizar la respuesta técnica de una entrega reintentada, sin duplicar
      // una respuesta asistente del mismo turno; los intentos siguen auditados.
      turn.messages = turn.messages.filter(m => m.role !== 'asistente');
      turn.messages.push({ role: 'asistente', text, origin, at: new Date().toISOString() });
      turn.status = 'COMPLETADA';
      turn.attempts[turn.attempts.length - 1].result = 'COMPLETADA';
      await this.saveOwned(personId, rowId, executionId, turn);
      return { ...this.view(rowId, turn), replayed: false };
    } catch {
      // No filtrar mensajes del proveedor ni credenciales al historial administrativo.
      turn.status = 'PENDIENTE';
      turn.confirmation = undefined;
      turn.attempts[turn.attempts.length - 1].result = 'PENDIENTE';
      turn.attempts[turn.attempts.length - 1].errorCode = turn.evaluation?.estado === 'PENDIENTE'
        ? 'MODEL_OR_EVALUATION_PENDING' : 'SQL_OR_PERSISTENCE_ERROR';
      turn.messages = turn.messages.filter(m => m.role !== 'asistente');
      turn.messages.push({ role: 'sistema', text: 'No se pudo completar el turno. El mensaje está guardado y puede reintentarse.',
        origin: 'BACKEND_ERROR', at: new Date().toISOString() });
      try { await this.saveOwned(personId, rowId, executionId, turn); }
      catch (error) {
        if (!(error instanceof ExecutionLost)) throw error;
        const current = await this.db.decisionesIA.findFirst({ where: { agente: AGENT, id_persona: personId, id_decision: rowId } });
        if (!current) throw error;
        return { ...this.view(rowId, parse(current) as Turn, await this.sqlNow(this.db)), replayed: true, executionSuperseded: true };
      }
      return { ...this.view(rowId, turn), replayed: false };
    }
  }
}
