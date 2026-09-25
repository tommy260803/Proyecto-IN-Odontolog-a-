import { queryMart } from '../db/mart';

async function testLeadEtl() {
  const result = await queryMart(`
    SELECT 
        CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT) AS KeyTiempo,
        ISNULL(ds.KeySede, 1) AS KeySede,
        ISNULL(dn.KeyNegociador, 1) AS KeyNegociador,
        COUNT(DISTINCT ev.id_persona) AS LeadsCohorteEvaluable,
        SUM(CASE WHEN p.id_etapa_actual >= 3 THEN 1 ELSE 0 END) AS LeadsConvertidosPayer14Dias,
        SUM(CASE WHEN p.id_etapa_actual = 2 THEN 1 ELSE 0 END) AS LeadsEnNegociacion,
        SUM(CASE WHEN p.id_etapa_actual < 2 THEN 1 ELSE 0 END) AS LeadsAbandonados
    FROM [NexoSaludDB].dbo.[EventosEtapa] ev
    JOIN [NexoSaludDB].dbo.[Personas] p ON ev.id_persona = p.id_persona
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Sede] ds ON ds.id_sede = 1
    LEFT JOIN [NexoSalud_Mart].dbo.[Dim_Negociador] dn ON dn.id_usuario = 1
    WHERE ev.etapa_destino = 2
    GROUP BY CAST(FORMAT(ev.fecha_hora, 'yyyyMMdd') AS INT), ds.KeySede, dn.KeyNegociador
  `);
  console.log('Lead ETL query result:', result);
  process.exit(0);
}

testLeadEtl().catch(err => {
  console.error(err);
  process.exit(1);
});
