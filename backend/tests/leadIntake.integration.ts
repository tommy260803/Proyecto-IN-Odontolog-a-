import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/db';
import { registerLeadIntake } from '../src/services/leadIntake';

async function run() {
  const [target] = await prisma.$queryRaw<{ db: string; intakeProcedureId: number | null; queueId: number | null }[]>`
    SELECT DB_NAME() AS db, OBJECT_ID('dbo.usp_RegistrarEntradaAgenteLead', 'P') AS intakeProcedureId,
      OBJECT_ID('dbo.TrabajosAgenteLead', 'U') AS queueId
  `;
  assert.equal(target.db, 'NexoSalud_LeadPruebas');
  assert.ok(target.intakeProcedureId, 'Instalar ENTRADA_AGENTE_LEAD_QA.sql.');

  const buyer = await prisma.etapas.findUniqueOrThrow({ where: { nombre: 'BUYER' } });
  const service = await prisma.servicios.findFirstOrThrow({ where: { activo: true } });
  const person = await prisma.personas.create({ data: {
    nombres: 'Entrada', apellidos: 'QA', email: randomUUID() + '@example.invalid',
    id_etapa_actual: buyer.id_etapa, autoriza_contacto: true, fecha_autorizacion: new Date(),
    estado_calidad: 'Valido',
  } });
  const personId = person.id_persona;
  try {
    const unconverted = await prisma.solicitudes.create({ data: {
      id_persona: personId, id_servicio: service.id_servicio, fecha_solicitud: new Date(),
    } });
    await assert.rejects(registerLeadIntake(unconverted.id_solicitud), /54703|no tiene una conversion/i);

    const [capture] = await prisma.$queryRaw<{ id_captacion: number }[]>`
      INSERT dbo.CaptacionesBuyer
        (id_persona, fecha_captacion, id_servicio, estado_calidad,
         autoriza_contacto, fecha_autorizacion, origen_datos)
      OUTPUT inserted.id_captacion
      VALUES (${personId}, SYSDATETIME(), ${service.id_servicio}, 'Valido',
              1, SYSDATETIME(), 'REGISTRO_DIRECTO')
    `;
    const convert = async () => {
      const [row] = await prisma.$queryRaw<{ id_evento_etapa: number; id_solicitud: number; ya_convertido: number }[]>`
        EXEC dbo.usp_ConvertirBuyerALead @id_captacion = ${capture.id_captacion},
          @id_servicio = ${service.id_servicio}, @motivo = N'Reserva confirmada QA'
      `;
      return row;
    };
    // Simular pérdida del aviso después de confirmar la conversión.
    const initial = await convert();
    const recovered = await convert();
    assert.equal(recovered.id_solicitud, initial.id_solicitud);
    assert.equal(recovered.id_evento_etapa, initial.id_evento_etapa);
    assert.equal(Number(recovered.ya_convertido), 1);

    const expected = {
      id_solicitud: initial.id_solicitud, id_evento_etapa: initial.id_evento_etapa,
      id_captacion: capture.id_captacion, id_persona: personId,
    };
    const entries = await Promise.all(Array.from({ length: 8 }, () => registerLeadIntake(initial.id_solicitud)));
    for (const entry of entries) assert.deepEqual(entry, expected);
    // Simular pérdida de la respuesta después de guardar la entrada.
    assert.deepEqual(await registerLeadIntake(initial.id_solicitud), expected);
    const [counts] = await prisma.$queryRaw<{ entradas: number; conversiones: number; solicitudes: number }[]>`
      SELECT
        (SELECT COUNT(*) FROM dbo.EntradasAgenteLead WHERE id_persona = ${personId}) AS entradas,
        (SELECT COUNT(*) FROM dbo.EventosEtapa WHERE id_captacion = ${capture.id_captacion}) AS conversiones,
        (SELECT COUNT(*) FROM dbo.Solicitudes WHERE id_persona = ${personId}
          AND id_solicitud <> ${unconverted.id_solicitud}) AS solicitudes
    `;
    assert.deepEqual(counts, { entradas: 1, conversiones: 1, solicitudes: 1 });
    if (target.queueId) {
      const claim = () => prisma.$queryRaw<{ token: string; intentos: number }[]>`
        EXEC dbo.usp_TomarTrabajoAgenteLead @id_solicitud = ${initial.id_solicitud}
      `;
      const claims = (await Promise.all(Array.from({ length: 8 }, claim))).flat();
      assert.equal(claims.length, 1);
      assert.equal(claims[0].intentos, 1);
      // Vencer la toma de este caso para simular una caída sin esperar el plazo.
      await prisma.$executeRaw`
        UPDATE dbo.TrabajosAgenteLead SET vence_utc = SYSUTCDATETIME()
        WHERE id_solicitud = ${initial.id_solicitud}
      `;
      const [second] = await claim();
      assert.equal(second.intentos, 2);
      assert.notEqual(second.token, claims[0].token);
      const finish = async (token: string) => {
        const [row] = await prisma.$queryRaw<{ aplicado: boolean }[]>`
          EXEC dbo.usp_ResolverTrabajoAgenteLead @id_solicitud = ${initial.id_solicitud},
            @token = ${token}, @resultado = 'COMPLETADO'
        `;
        return row.aplicado;
      };
      assert.equal(await finish(claims[0].token), false);
      assert.equal(await finish(second.token), true);
      assert.equal(await finish(second.token), false);
      assert.deepEqual(await claim(), []);
      const audit = await prisma.$queryRaw<{ intento: number; accion: string }[]>`
        SELECT intento, accion FROM dbo.AuditoriaTrabajosAgenteLead
        WHERE id_solicitud = ${initial.id_solicitud} ORDER BY id_auditoria
      `;
      assert.deepEqual(audit, [
        { intento: 1, accion: 'TOMADO' },
        { intento: 2, accion: 'TOMADO' },
        { intento: 2, accion: 'COMPLETADO' },
      ]);
      console.log('OK: una toma concurrente, recuperación, rechazo de token vencido y auditoría.');
    }
  } finally {
    await prisma.$transaction(async tx => {
      if (target.queueId) {
        await tx.$executeRaw`
          DELETE a FROM dbo.AuditoriaTrabajosAgenteLead a
          JOIN dbo.EntradasAgenteLead e ON e.id_solicitud = a.id_solicitud
          WHERE e.id_persona = ${personId}
        `;
        await tx.$executeRaw`
          DELETE t FROM dbo.TrabajosAgenteLead t
          JOIN dbo.EntradasAgenteLead e ON e.id_solicitud = t.id_solicitud
          WHERE e.id_persona = ${personId}
        `;
      }
      await tx.$executeRaw`DELETE dbo.EntradasAgenteLead WHERE id_persona = ${personId}`;
      await tx.$executeRaw`DELETE dbo.EventosEtapa WHERE id_persona = ${personId}`;
      await tx.$executeRaw`DELETE dbo.Solicitudes WHERE id_persona = ${personId}`;
      await tx.$executeRaw`DELETE dbo.CaptacionesBuyer WHERE id_persona = ${personId}`;
      await tx.$executeRaw`DELETE dbo.Personas WHERE id_persona = ${personId}`;
    });
  }
  console.log('OK: conversión confirmada, reenvíos concurrentes y recuperación en QA.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
