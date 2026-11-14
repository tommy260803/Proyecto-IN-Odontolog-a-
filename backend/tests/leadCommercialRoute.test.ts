import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import express from 'express';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const { tx, db } = vi.hoisted(() => {
  const tx = {
    solicitudes: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    propuestasEconomicasLead: { findFirst: vi.fn(), create: vi.fn() },
    opciones: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    personas: { findUnique: vi.fn() },
    usuarios: { findUnique: vi.fn() },
    reservas: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    tarifas: { findFirst: vi.fn() },
    profesionalServicio: { findFirst: vi.fn() },
    eventosEtapa: { findFirst: vi.fn() },
    motivosRechazoLead: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { tx, db: { $transaction: vi.fn(), $queryRaw: vi.fn(), usuarios: { findUnique: vi.fn() } } };
});
vi.mock('../src/db', () => ({ prisma: db }));

import { leadCommercialRouter } from '../src/routes/leadCommercial.routes';
import leadRoutes from '../src/routes/lead.routes';
import { hashLeadStaffPassword } from '../src/services/leadStaffAuth';
import { hashAccess } from '../src/services/leadPayerTransfer';

const app = express();
app.use(express.json());
app.use('/commercial', leadCommercialRouter);
app.use('/legacy-lead', leadRoutes);
let server: ReturnType<typeof app.listen>;
let url: string;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/commercial';
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async action => action(tx));
  tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_servicio: 5 });
  tx.$queryRaw.mockResolvedValue([{ ingreso: new Date() }]);
});

function post(path: string, body: unknown) {
  return fetch(url + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('edita la tarifa con un porcentaje decimal y rechaza descuentos superiores al máximo', async () => {
  vi.stubEnv('LEAD_STAFF_AUTH_QA', 'false');
  vi.stubEnv('LEAD_STAFF_AUTH_ENABLED', 'false');
  const serviceId = 1;
  const base = new Prisma.Decimal('125.50');
  const person = { Etapa: { nombre: 'LEAD' } };
  const request = { id_solicitud: 12, id_persona: 5, id_servicio: serviceId, estado: 'Abierta', Persona: person, Servicio: { activo: true } };
  const proposal = { id_propuesta: 20, numero_version: 1, id_solicitud: 12, id_servicio: serviceId,
    estado: 'Pendiente', precio_cotizado: base, fecha_vigencia_hasta_utc_lead: new Date('2099-08-19T15:00:00Z') };
  const slot = { id_disponibilidad: 40, id_sede: 2, id_profesional: 3, fecha: new Date('2099-08-20'),
    hora_inicio: new Date('1970-01-01T09:00:00Z'), hora_fin: new Date('1970-01-01T09:30:00Z'),
    estado: 'Disponible', Profesional: { activo: true }, Sede: { activo: true } };
  tx.solicitudes.findUnique.mockResolvedValue(request);
  tx.solicitudes.findFirst.mockResolvedValue(request);
  tx.opciones.findFirst.mockImplementation(async ({ where }) => where.id_opcion === 30
    ? { id_opcion: 30, Propuesta: proposal, Disponibilidad: slot, precio_ofrecido: base } : null);
  tx.profesionalServicio.findFirst.mockResolvedValue({});
  tx.tarifas.findFirst.mockResolvedValue({ id_tarifa: 2, precio: base });
  tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => strings.join('').includes('HistorialOpcionesLead') ? [{ ok: 1 }] : []);
  tx.propuestasEconomicasLead.create.mockResolvedValue({ id_propuesta: 21 });
  tx.opciones.update.mockImplementation(async ({ data }) => ({ id_opcion: 30, ...data }));
  const patch = (discount: number) => fetch(url + '/opportunities/12/alternatives/30/discount', {
    method: 'PATCH', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
    body: JSON.stringify({ id_propuesta: 20, id_tarifa: 2, tarifa_base: '125.50', descuento_pct: discount }),
  });
  try {
    const excessive = await patch(99);
    expect(excessive.status).toBe(400);
    expect((await excessive.json()).error).toMatch(/descuento máximo/);
    expect(tx.propuestasEconomicasLead.create).not.toHaveBeenCalled();
    const edited = await patch(7.5);
    expect(edited.status).toBe(200);
    expect((await edited.json()).data).toMatchObject({ id_propuesta_lead: 21, precio_ofrecido: '116.09' });
    expect(tx.propuestasEconomicasLead.create.mock.calls[0][0].data.promocion_aplicada).toBe('Promoción (-7.5%)');
  } finally {
    vi.unstubAllEnvs();
  }
});

test('aplica la revisión confirmada y reintenta sin volver a enviar por OpenWA', async () => {
  vi.stubEnv('LEAD_STAFF_AUTH_QA', 'false');
  vi.stubEnv('LEAD_STAFF_AUTH_ENABLED', 'false');
  vi.stubEnv('OPENWA_SESSION_ID', 'qa');
  vi.stubEnv('OPENWA_BASE_URL', 'https://openwa.example');
  vi.stubEnv('OPENWA_API_KEY', 'test');
  vi.stubEnv('LEAD_PUBLIC_RESERVATION_URL', 'https://reservas.example');
  const base = new Prisma.Decimal(100);
  const expiry = new Date('2099-08-19T15:00:00Z');
  const date = new Date('2099-08-20');
  const request = { id_solicitud: 12, id_persona: 5, id_servicio: 7, estado: 'Abierta', Servicio: { activo: true, nombre: 'Limpieza' },
    Persona: { autoriza_contacto: true, numero: '900000000', Etapa: { nombre: 'LEAD' } } };
  tx.solicitudes.findUnique.mockResolvedValue(request);
  tx.solicitudes.findFirst.mockResolvedValue(request);
  tx.profesionalServicio.findFirst.mockResolvedValue({});
  const option = (id: number, site: string, professional: string) => ({ id_opcion: id, seleccionada: id === 30, precio_ofrecido: base,
    Propuesta: { id_propuesta: id - 10, numero_version: 1, id_solicitud: 12, id_servicio: 7, estado: 'Pendiente',
      precio_cotizado: base, fecha_vigencia_hasta_utc_lead: expiry },
    Disponibilidad: { id_disponibilidad: id + 10, id_sede: id, id_profesional: id, fecha: date,
      hora_inicio: new Date('1970-01-01T09:00:00Z'), hora_fin: new Date('1970-01-01T09:30:00Z'),
      estado: 'Disponible', Profesional: { activo: true, nombres: professional, apellidos: 'Mendoza' }, Sede: { activo: true, nombre: site } } });
  tx.opciones.findFirst.mockImplementation(async ({ where }) => where.id_opcion === 30
    ? option(30, 'Centro Histórico', 'Valeria') : option(31, 'California', 'Ana'));
  const reference = (id: number) => ({ personId: 5, requestId: 12, optionId: id, proposalId: id - 10,
    fingerprint: hashAccess(JSON.stringify([5, 12, id, id - 10, 1, '100.00', expiry.toISOString(), '100.00',
      id + 10, id, id, '2099-08-20', '09:00:00', '09:30:00'])) });
  let sent = false;
  const plan = JSON.stringify({ revisionOrigin: reference(30), offer: reference(31) });
  const sqlWrites: string[] = [];
  Object.assign(tx, { canales: { findFirst: vi.fn().mockResolvedValue({ id_canal: 1 }) },
    interacciones: { create: vi.fn().mockResolvedValue({ id_interaccion: 51 }) },
    $executeRaw: async (strings: TemplateStringsArray) => { sqlWrites.push(strings.join('')); return 1; } });
  tx.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
    const sql = strings.join('');
    if (sql.includes('sp_getapplock')) return [{ code: 0 }];
    if (sql.includes('AS messageId')) return [{ messageId: 41n, plan }];
    if (sql.includes('revisionInteractionId') && sent) return [{ id: 1 }];
    if (sql.includes('HistorialOpcionesLead')) return [{ ok: 1 }];
    return [];
  });
  const actualFetch = globalThis.fetch;
  const outbound: string[] = [];
  const mocked = vi.spyOn(globalThis, 'fetch').mockImplementation(async (target, init) => {
    if (!String(target).startsWith('https://openwa.example/')) return actualFetch(target, init);
    outbound.push(JSON.parse(String(init?.body)).text);
    sent = true;
    return Response.json({ messageId: 'mock-revision' }, { status: 201 });
  });
  const apply = () => fetch(url + '/opportunities/12/apply-revision', { method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' }, body: JSON.stringify({ id_interaccion: 40 }) });
  try {
    const applied = await apply();
    expect(applied.status).toBe(200);
    expect(await applied.json()).toEqual({ id_opcion: 31, id_propuesta: 21 });
    expect((await apply()).status).toBe(200);
    expect(outbound).toHaveLength(1);
    expect(outbound[0]).toMatch(/propuesta actualizada[\s\S]*California[\s\S]*Ana Mendoza[\s\S]*reservas\.example\/pre-reserva\/5#token=/);
    expect(tx.opciones.update).toHaveBeenCalledTimes(2);
    expect(tx.opciones.update.mock.calls[0][0].data.archivada_lead_en).toBeInstanceOf(Date);
    expect(sqlWrites.some(sql => sql.includes('UPDATE dbo.AccesosPreReservaLead'))).toBe(true);
  } finally {
    mocked.mockRestore();
    vi.unstubAllEnvs();
  }
});

test('el selector de paciente devuelve sus solicitudes por separado y pagina por solicitud', async () => {
  db.$queryRaw.mockResolvedValue(Array.from({ length: 26 }, (_, index) => ({
    id_persona: 5, id_solicitud: 100 - index,
  })));
  const response = await fetch(url + '/opportunities?id_persona=5&pagina=2');
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.hay_siguiente).toBe(true);
  expect(result.oportunidades).toHaveLength(25);
  expect(result.oportunidades.slice(0, 2).map((row: { id_solicitud: number }) => row.id_solicitud)).toEqual([100, 99]);
  const [query] = db.$queryRaw.mock.calls[0];
  expect(query.sql).toContain('s.id_persona = ?');
  expect(query.sql).toContain('ORDER BY prioridad.prioridad_operativa');
  expect(query.sql).toContain('c.fecha_solicitud DESC, s.id_solicitud DESC');
  expect(query.values).toEqual([5, 25n, 26]);
});

test('la bandeja rechaza un intervalo de ingreso invertido y filtros de seguimiento desconocidos', async () => {
  expect((await fetch(url + '/opportunities?ingreso_desde=2026-11-11&ingreso_hasta=2026-11-10')).status).toBe(400);
  expect((await fetch(url + '/opportunities?seguimiento=urgente')).status).toBe(400);
  expect(db.$queryRaw).not.toHaveBeenCalled();
});

test('un ID de persona ambiguo se rechaza antes de consultar SQL', async () => {
  const response = await fetch(url + '/opportunities?id_persona=paciente5');
  expect(response.status).toBe(400);
  expect(db.$queryRaw).not.toHaveBeenCalled();
});

test('la búsqueda de candidatos requiere una solicitud abierta y su servicio registrado', async () => {
  const path = '/opportunities/12/availability?fecha=2026-12-03';
  tx.solicitudes.findUnique.mockResolvedValueOnce({ id_solicitud: 12, resultado_comercial_lead: 'ACEPTADA' });
  expect((await fetch(url + path)).status).toBe(409);
  tx.solicitudes.findUnique.mockResolvedValueOnce({ id_solicitud: 12, id_servicio: null });
  expect((await fetch(url + path)).status).toBe(400);
  expect(tx.$queryRaw).toHaveBeenCalledTimes(2);

  tx.$queryRaw.mockResolvedValueOnce([{ ingreso: new Date() }]).mockResolvedValueOnce([]);
  const response = await fetch(url + path);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ candidatas: [], hay_siguiente: false });
  expect(tx.solicitudes.findUnique).toHaveBeenLastCalledWith({ where: { id_solicitud: 12 } });
  expect(tx.$queryRaw.mock.lastCall?.[0].values).toEqual([5, '2026-12-03', 0n]);
});

test('la bitácora incluye solo la solicitud y persona acreditadas y pagina en orden estable', async () => {
  tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_persona: 5 });
  tx.$queryRaw.mockResolvedValueOnce([{ ingreso: new Date() }]).mockResolvedValueOnce(
    Array.from({ length: 26 }, (_, i) => ({ id_interaccion: 100 - i })),
  );
  const response = await fetch(url + '/opportunities/12/activity?pagina=2');
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.interacciones).toHaveLength(25);
  expect(body.hay_siguiente).toBe(true);
  const [query] = tx.$queryRaw.mock.lastCall!;
  expect(query.sql).toContain('i.id_solicitud = ? AND i.id_persona = ?');
  expect(query.sql).toContain('ORDER BY i.fecha_hora DESC, i.id_interaccion DESC');
  expect(query.values).toEqual([12, 5, 25n]);
});

test('la preparación para PAYER no infiere autorización ni crea reservas', async () => {
  tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_persona: 5, resultado_comercial_lead: 'PENDIENTE' });
  tx.personas.findUnique.mockResolvedValue({ Etapa: { nombre: 'LEAD' } });
  tx.opciones.findMany.mockResolvedValue([]);
  tx.reservas.findMany.mockResolvedValue([]);
  tx.$queryRaw.mockResolvedValueOnce([{ ingreso: new Date() }]).mockResolvedValueOnce([]);
  const response = await fetch(url + '/opportunities/12/payer-readiness');
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.estado).toBe('bloqueado');
  expect(body.requisitos).toEqual(expect.arrayContaining([
    expect.objectContaining({ codigo: 'etapa', estado: 'cumple' }),
    expect.objectContaining({ codigo: 'acuerdo', estado: 'bloqueado' }),
    expect.objectContaining({ codigo: 'autorizacion', estado: 'pendiente' }),
  ]));
  expect(tx.reservas.create).not.toHaveBeenCalled();
  expect(tx.solicitudes.update).not.toHaveBeenCalled();
});

test('la sesión QA exige una contraseña verificada y restringe al negociador a su solicitud', async () => {
  vi.stubEnv('LEAD_STAFF_AUTH_QA', 'true');
  try {
    db.$queryRaw.mockResolvedValue([{ db: 'NexoSalud_LeadPruebas' }]);
    const password = 'clave temporal para QA';
    const user = { id_usuario: 4, nombres: 'Usuario', apellidos: 'QA', activo: true,
      Rol: { nombre: 'Negociador' }, password_hash: await hashLeadStaffPassword(password) };
    db.usuarios.findUnique.mockResolvedValue(user);
    tx.usuarios.findUnique.mockResolvedValue(user);
    tx.$queryRaw.mockImplementation(async strings =>
      String(strings).includes('DB_NAME()') ? [{ db: 'NexoSalud_LeadPruebas' }] : [{ ingreso: new Date() }]);
    expect((await post('/staff/session', { email: 'qa@example.invalid', password: 'incorrecta' })).status).toBe(401);
    const login = await post('/staff/session', { email: 'qa@example.invalid', password });
    expect(login.status).toBe(200);
    const session = await login.json();
    expect(session.usuario).not.toHaveProperty('password_hash');
    const headers = { Authorization: 'Bearer ' + session.token };
    const path = '/opportunities/12/staff-access';
    expect((await fetch(url + path, { headers: { 'x-id-usuario': '4' } })).status).toBe(401);
    tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_negociador: 7 });
    expect((await fetch(url + path, { headers })).status).toBe(403);
    tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_negociador: 4 });
    expect((await fetch(url + path, { headers })).status).toBe(200);
    const patch = (body: unknown) => fetch(url + '/opportunities/12/follow-up', {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const local = '2099-12-31T23:30';
    const next = new Date('2100-01-01T04:30:00.000Z');
    tx.solicitudes.update.mockResolvedValue({ id_solicitud: 12, fecha_proximo_seguimiento: next });
    expect((await patch({ fecha_lima: local, fecha_esperada_utc: null })).status).toBe(200);
    expect(tx.solicitudes.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { fecha_proximo_seguimiento: next },
    }));
    tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_negociador: 4, fecha_proximo_seguimiento: next });
    expect((await patch({ fecha_lima: local, fecha_esperada_utc: null })).status).toBe(200);
    expect((await patch({ fecha_lima: null, fecha_esperada_utc: null })).status).toBe(409);
    expect(tx.solicitudes.update).toHaveBeenCalledTimes(1);
    expect((await fetch(url + '/staff/session', { method: 'DELETE', headers })).status).toBe(204);
    expect((await fetch(url + path, { headers })).status).toBe(401);
  } finally {
    vi.unstubAllEnvs();
  }
});

test('el modo operativo exige credenciales reales y bloquea escrituras comerciales heredadas', async () => {
  vi.stubEnv('LEAD_STAFF_AUTH_QA', 'false');
  vi.stubEnv('LEAD_STAFF_AUTH_ENABLED', 'true');
  try {
    const password = 'contraseña operativa de prueba';
    const user = { id_usuario: 8, nombres: 'Operador', apellidos: 'Real', activo: true,
      Rol: { nombre: 'Administrador' }, password_hash: await hashLeadStaffPassword(password) };
    db.usuarios.findUnique.mockResolvedValue(user);
    tx.usuarios.findUnique.mockResolvedValue(user);
    tx.$queryRaw.mockResolvedValue([{ ingreso: new Date() }]);

    const legacy = await post('/opportunities/12/proposals', { precio_cotizado: '100.00' });
    expect(legacy.status).toBe(410);
    expect((await fetch(url.replace('/commercial', '/legacy-lead/12/abandon'), { method: 'POST' })).status).toBe(410);
    expect(db.$transaction).not.toHaveBeenCalled();

    expect((await post('/opportunities/12/alternatives', {
      id_disponibilidad: 1, id_sede: 1, id_profesional: 1, dia: '2026-12-03',
      inicio_exacto: '09:00:00.0000000', fin_exacto: '10:00:00.0000000',
      precio_ofrecido: '100.00', turno_ofrecido: 'Mañana', opciones_esperadas: [],
    })).status).toBe(401);
    expect((await post('/staff/session', { email: 'operador@example.invalid', password: 'incorrecta' })).status).toBe(401);
    const login = await post('/staff/session', { email: 'operador@example.invalid', password });
    expect(login.status).toBe(200);
    const session = await login.json();
    const access = await fetch(url + '/opportunities/12/staff-access', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(access.status).toBe(200);
    expect(tx.$queryRaw.mock.calls.some(([query]) => String(query).includes('DB_NAME()'))).toBe(false);
  } finally {
    vi.unstubAllEnvs();
  }
});

test('L1 exige una confirmación expresa y usa el precio de la propuesta vigente', async () => {
  const path = '/opportunities/12/outcome';
  const denied = await post(path, { resultado: 'ACEPTADA', id_propuesta: 7, id_reserva: 1 });
  expect(denied.status).toBe(400);
  expect(tx.solicitudes.update).not.toHaveBeenCalled();

  const proposal = { id_propuesta: 7, id_solicitud: 12, estado: 'Aceptada', precio_cotizado: '150.00' };
  tx.propuestasEconomicasLead.findFirst.mockResolvedValue(proposal);
  tx.solicitudes.update.mockResolvedValue({ id_solicitud: 12 });
  const accepted = await post(path, { resultado: 'ACEPTADA', id_propuesta: 7, aceptacion_expresa: true, valor_acordado: 999 });
  expect(accepted.status).toBe(200);
  expect(tx.solicitudes.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ valor_acordado_lead: '150.00', id_propuesta_aceptada_lead: 7 }),
  }));
});

test('L2 agrega una versión a la raíz y rechaza una versión anterior obsoleta', async () => {
  const path = '/opportunities/12/proposals';
  const prior = { id_propuesta: 9, id_propuesta_raiz: 7, numero_version: 2 };
  tx.propuestasEconomicasLead.findFirst.mockResolvedValue(prior);
  tx.propuestasEconomicasLead.create.mockResolvedValue({ id_propuesta: 10 });
  const revised = await post(path, { id_version_anterior: 9, precio_cotizado: '120.50' });
  expect(revised.status).toBe(201);
  expect(tx.propuestasEconomicasLead.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ id_propuesta_raiz: 7, numero_version: 3 }),
  }));

  tx.propuestasEconomicasLead.findFirst.mockResolvedValueOnce(prior).mockResolvedValueOnce({ id_propuesta: 10 });
  const stale = await post(path, { id_version_anterior: 9, precio_cotizado: '130.00' });
  expect(stale.status).toBe(409);
  expect(tx.propuestasEconomicasLead.create).toHaveBeenCalledTimes(1);
});

test('L3 exige un motivo válido de ALTERNATIVA para registrar un rechazo', async () => {
  const path = '/opportunities/12/alternatives/8/decision';
  tx.opciones.findFirst.mockResolvedValue({ id_opcion: 8 });
  tx.motivosRechazoLead.findFirst.mockResolvedValue(null);
  expect((await post(path, { estado: 'Rechazada', id_motivo_rechazo_lead: 2 })).status).toBe(400);
  expect(tx.opciones.update).not.toHaveBeenCalled();

  tx.motivosRechazoLead.findFirst.mockResolvedValue({ id_motivo_rechazo: 3 });
  tx.opciones.update.mockResolvedValue({ id_opcion: 8 });
  expect((await post(path, { estado: 'Rechazada', id_motivo_rechazo_lead: 3 })).status).toBe(200);
  expect(tx.motivosRechazoLead.findFirst).toHaveBeenLastCalledWith({
    where: { id_motivo_rechazo: 3, ambito: 'ALTERNATIVA', activo: true },
  });
});

test('los reportes rechazan fechas inválidas sin consultar la base', async () => {
  const result = await fetch(url + '/reports/R1?inicio=2026-02-31&fin_exclusivo=2026-03-01');
  expect(result.status).toBe(400);
  expect(db.$queryRaw).not.toHaveBeenCalled();
});
