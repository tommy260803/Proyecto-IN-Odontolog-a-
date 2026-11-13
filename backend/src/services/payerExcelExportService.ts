import ExcelJS from 'exceljs';
import { prisma } from '../db';

/**
 * Paleta corporativa para reportes Excel de NexoSalud
 */
const BRAND_COLORS = {
  headerBg: 'FF0D5C75',      // Teal Clínico Oscuro
  headerBiBg: 'FF1E3A8A',    // Azul Marino Power BI
  headerKpiBg: 'FF0F766E',   // Verde Azulado Ejecutivo
  zebraBg: 'FFF8FAFC',       // Gris muy suave para filas alternas
  borderColor: 'FFE2E8F0',   // Gris claro bordes
  statusValidadoBg: 'FFDCFCE7',
  statusValidadoFg: 'FF166534',
  statusPendienteBg: 'FFFEF9C3',
  statusPendienteFg: 'FF854D0E',
  statusRevisionBg: 'FFE0F2FE',
  statusRevisionFg: 'FF075985',
  statusRechazadoBg: 'FFFEE2E2',
  statusRechazadoFg: 'FF991B1B',
  semaforoVerdeBg: 'FFDCFCE7',
  semaforoVerdeFg: 'FF15803D',
  semaforoAmbarBg: 'FFFEF3C7',
  semaforoAmbarFg: 'FFB45309',
  semaforoRojoBg: 'FFFEE2E2',
  semaforoRojoFg: 'FFB91C1C',
};

/**
 * Aplica estilos a la fila de cabecera
 */
function applyHeaderStyle(row: ExcelJS.Row, bgArgb = BRAND_COLORS.headerBg) {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

/**
 * Ajusta automáticamente el ancho de las columnas
 */
function autoFitColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    if (!column || !column.eachCell) return;
    let maxLength = 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const val = cell.value ? cell.value.toString() : '';
      if (val.length > maxLength) maxLength = val.length;
    });
    column.width = Math.min(Math.max(maxLength + 4, 12), 40);
  });
}

/**
 * Aplica estilos de celda estándar de datos
 */
function styleDataRow(row: ExcelJS.Row, isEven: boolean) {
  row.height = 20;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9.5 };
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND_COLORS.borderColor } },
      left: { style: 'thin', color: { argb: BRAND_COLORS.borderColor } },
      bottom: { style: 'thin', color: { argb: BRAND_COLORS.borderColor } },
      right: { style: 'thin', color: { argb: BRAND_COLORS.borderColor } },
    };
    if (isEven) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.zebraBg } };
    }
  });
}

/**
 * 1. Genera la Tabla General Consolidada (Plana) en Excel (.xlsx)
 */
export async function generatePayerConsolidatedExcel(): Promise<Buffer> {
  const query = `
    SELECT 
        p.id_pago AS IdPago,
        ISNULL(p.referencia_pago, CONCAT('PR-', RIGHT('00000' + CAST(p.id_pago AS VARCHAR), 5))) AS ReferenciaPago,
        r.id_reserva AS IdReserva,
        CONCAT('RES-', RIGHT('00000' + CAST(r.id_reserva AS VARCHAR), 5)) AS CodigoReserva,
        CONCAT(per.nombres, ' ', per.apellidos) AS NombrePaciente,
        ISNULL(per.dni, '-') AS DniPaciente,
        ISNULL(per.email, '-') AS EmailPaciente,
        s.nombre AS Sede,
        ISNULL(serv.nombre, 'Evaluación General') AS ServicioOdontologico,
        ISNULL(p.canal_pago, 'Sin Definir') AS PasarelaPago,
        CASE 
            WHEN p.canal_pago IN ('Yape', 'Plin') THEN 'Billetera Digital'
            WHEN p.canal_pago LIKE '%Tarjeta%' THEN 'Tarjeta Web'
            ELSE 'Transferencia / Depósito'
        END AS TipoMedioPago,
        UPPER(CASE 
            WHEN p.estado IN ('VALIDATED', 'Validado') THEN 'VALIDADO'
            WHEN p.estado IN ('REJECTED', 'Rechazado') THEN 'RECHAZADO'
            WHEN p.estado IN ('PENDING', 'Pendiente') THEN 'PENDIENTE'
            ELSE p.estado
        END) AS EstadoPago,
        CAST(p.importe AS DECIMAL(10,2)) AS MontoPago_PEN,
        CAST(p.fecha_registro AS DATE) AS FechaRegistro,
        YEAR(p.fecha_registro) AS AnioRegistro,
        MONTH(p.fecha_registro) AS MesRegistro,
        DATENAME(MONTH, p.fecha_registro) AS NombreMesRegistro,
        CAST(p.fecha_declaracion AS DATE) AS FechaDeclaracion,
        CAST(p.fecha_validacion AS DATE) AS FechaValidacion,
        CASE 
            WHEN p.fecha_validacion IS NOT NULL AND p.fecha_validacion >= ISNULL(p.fecha_declaracion, p.fecha_registro)
            THEN DATEDIFF(MINUTE, ISNULL(p.fecha_declaracion, p.fecha_registro), p.fecha_validacion)
            WHEN p.fecha_validacion IS NOT NULL AND p.fecha_validacion < ISNULL(p.fecha_declaracion, p.fecha_registro)
            THEN 15
            ELSE 0 
        END AS TiempoValidacionMinutos,
        ISNULL(r.ultima_alerta_dunning, 'Sin Notificación Previa') AS EtapaCadenciaDunning,
        ISNULL(r.score_riesgo_impago, 0) AS ScoreRiesgoImpago,
        CASE 
            WHEN r.score_riesgo_impago >= 70 THEN 'ALTO'
            WHEN r.score_riesgo_impago >= 40 THEN 'MEDIO'
            ELSE 'BAJO'
        END AS NivelRiesgoImpago,
        CASE WHEN p.estado IN ('VALIDATED', 'Validado', 'VALIDADO') THEN 1 ELSE 0 END AS FlagPagoValidado,
        CASE WHEN p.estado IN ('REJECTED', 'Rechazado', 'RECHAZADO') THEN 1 ELSE 0 END AS FlagPagoRechazado,
        CASE WHEN p.estado IN ('PENDING', 'Pendiente', 'PENDIENTE') THEN 1 ELSE 0 END AS FlagPagoPendiente,
        CASE WHEN p.estado IN ('REVERTED', 'Revertido', 'REVERTIDO') THEN 1 ELSE 0 END AS FlagPagoRevertido,
        CASE WHEN p.estado IN ('VALIDATED', 'Validado', 'VALIDADO') THEN 1 ELSE 0 END AS FlagPasoACustomer,
        CASE WHEN r.estado = 'Cancelada' THEN 1 ELSE 0 END AS FlagSillonLiberado,
        ISNULL(inc.motivo_tipificado, 'Sin Incidencia') AS MotivoIncidencia,
        ISNULL(inc.prioridad, 'Baja') AS PrioridadIncidencia,
        ISNULL(inc.descripcion, 'Pago conforme verificado') AS DetalleIncidencia
    FROM NexoSaludDB.dbo.Pagos p
    INNER JOIN NexoSaludDB.dbo.Personas per ON per.id_persona = p.id_persona
    INNER JOIN NexoSaludDB.dbo.Reservas r ON r.id_reserva = p.id_reserva
    INNER JOIN NexoSaludDB.dbo.Opciones o ON o.id_opcion = r.id_opcion
    INNER JOIN NexoSaludDB.dbo.Disponibilidad d ON d.id_disponibilidad = o.id_disponibilidad
    INNER JOIN NexoSaludDB.dbo.Sedes s ON s.id_sede = d.id_sede
    INNER JOIN NexoSaludDB.dbo.Solicitudes sol ON sol.id_solicitud = r.id_solicitud
    LEFT JOIN NexoSaludDB.dbo.Servicios serv ON serv.id_servicio = sol.id_servicio
    LEFT JOIN NexoSaludDB.dbo.Incidencias inc ON inc.id_pago = p.id_pago
    ORDER BY p.id_pago DESC;
  `;

  const rows: any[] = await prisma.$queryRawUnsafe(query);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NexoSalud Odontología';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('PAYER Consolidado General', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = [
    { header: 'ID Pago', key: 'IdPago', width: 10 },
    { header: 'Referencia Proforma', key: 'ReferenciaPago', width: 16 },
    { header: 'ID Reserva', key: 'IdReserva', width: 12 },
    { header: 'Código Reserva', key: 'CodigoReserva', width: 14 },
    { header: 'Paciente', key: 'NombrePaciente', width: 24 },
    { header: 'DNI', key: 'DniPaciente', width: 12 },
    { header: 'Email', key: 'EmailPaciente', width: 25 },
    { header: 'Sede Clínica', key: 'Sede', width: 20 },
    { header: 'Servicio Odontológico', key: 'ServicioOdontologico', width: 22 },
    { header: 'Pasarela / Canal', key: 'PasarelaPago', width: 16 },
    { header: 'Tipo Medio', key: 'TipoMedioPago', width: 18 },
    { header: 'Estado Pago', key: 'EstadoPago', width: 14 },
    { header: 'Monto (S/)', key: 'MontoPago_PEN', width: 14 },
    { header: 'Fecha Registro', key: 'FechaRegistro', width: 14 },
    { header: 'Año', key: 'AnioRegistro', width: 8 },
    { header: 'Mes', key: 'MesRegistro', width: 8 },
    { header: 'Nombre Mes', key: 'NombreMesRegistro', width: 14 },
    { header: 'Fecha Declaración', key: 'FechaDeclaracion', width: 15 },
    { header: 'Fecha Validación', key: 'FechaValidacion', width: 15 },
    { header: 'Tiempo Validación (Min)', key: 'TiempoValidacionMinutos', width: 18 },
    { header: 'Etapa Cadencia Dunning', key: 'EtapaCadenciaDunning', width: 22 },
    { header: 'Score Riesgo Impago', key: 'ScoreRiesgoImpago', width: 16 },
    { header: 'Nivel Riesgo IA', key: 'NivelRiesgoImpago', width: 14 },
    { header: 'Pago Validado (0/1)', key: 'FlagPagoValidado', width: 16 },
    { header: 'Pago Rechazado (0/1)', key: 'FlagPagoRechazado', width: 16 },
    { header: 'Pago Pendiente (0/1)', key: 'FlagPagoPendiente', width: 16 },
    { header: 'Paso a CUSTOMER (0/1)', key: 'FlagPasoACustomer', width: 18 },
    { header: 'Sillón Liberado (0/1)', key: 'FlagSillonLiberado', width: 16 },
    { header: 'Motivo Incidencia', key: 'MotivoIncidencia', width: 24 },
    { header: 'Prioridad Incidencia', key: 'PrioridadIncidencia', width: 16 },
    { header: 'Detalle de Revisión', key: 'DetalleIncidencia', width: 35 },
  ];

  ws.columns = columns;

  applyHeaderStyle(ws.getRow(1), BRAND_COLORS.headerBiBg);

  rows.forEach((r, idx) => {
    const row = ws.addRow({
      ...r,
      MontoPago_PEN: Number(r.MontoPago_PEN || 0),
      FechaRegistro: r.FechaRegistro ? new Date(r.FechaRegistro).toISOString().split('T')[0] : '',
      FechaDeclaracion: r.FechaDeclaracion ? new Date(r.FechaDeclaracion).toISOString().split('T')[0] : '',
      FechaValidacion: r.FechaValidacion ? new Date(r.FechaValidacion).toISOString().split('T')[0] : '',
      TiempoValidacionMinutos: Math.max(0, Number(r.TiempoValidacionMinutos || 0)),
      ScoreRiesgoImpago: Number(r.ScoreRiesgoImpago || 0),
      FlagPagoValidado: Number(r.FlagPagoValidado || 0),
      FlagPagoRechazado: Number(r.FlagPagoRechazado || 0),
      FlagPagoPendiente: Number(r.FlagPagoPendiente || 0),
      FlagPasoACustomer: Number(r.FlagPasoACustomer || 0),
      FlagSillonLiberado: Number(r.FlagSillonLiberado || 0),
    });

    styleDataRow(row, idx % 2 === 0);

    // Formatear celda monetaria S/
    const montoCell = row.getCell('MontoPago_PEN');
    montoCell.numFmt = '"S/" #,##0.00';
    montoCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Formatear tiempos
    const tiempoCell = row.getCell('TiempoValidacionMinutos');
    tiempoCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Colorear estado
    const estadoCell = row.getCell('EstadoPago');
    const estadoVal = String(r.EstadoPago || '').toUpperCase();
    estadoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    estadoCell.font = { name: 'Segoe UI', size: 9.5, bold: true };

    if (estadoVal.includes('VALID')) {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.statusValidadoBg } };
      estadoCell.font = { ...estadoCell.font, color: { argb: BRAND_COLORS.statusValidadoFg } };
    } else if (estadoVal.includes('PEND')) {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.statusPendienteBg } };
      estadoCell.font = { ...estadoCell.font, color: { argb: BRAND_COLORS.statusPendienteFg } };
    } else if (estadoVal.includes('REV') || estadoVal.includes('REVISION')) {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.statusRevisionBg } };
      estadoCell.font = { ...estadoCell.font, color: { argb: BRAND_COLORS.statusRevisionFg } };
    } else if (estadoVal.includes('RECH') || estadoVal.includes('REVERT')) {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.statusRechazadoBg } };
      estadoCell.font = { ...estadoCell.font, color: { argb: BRAND_COLORS.statusRechazadoFg } };
    }

    // Colorear nivel de riesgo
    const riesgoCell = row.getCell('NivelRiesgoImpago');
    riesgoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const riesgoVal = String(r.NivelRiesgoImpago || '').toUpperCase();
    if (riesgoVal === 'ALTO') {
      riesgoCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: BRAND_COLORS.semaforoRojoFg } };
    } else if (riesgoVal === 'MEDIO') {
      riesgoCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: BRAND_COLORS.semaforoAmbarFg } };
    } else {
      riesgoCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: BRAND_COLORS.semaforoVerdeFg } };
    }
  });

  // Habilitar filtros automáticos en toda la tabla
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };

  autoFitColumns(ws);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 2. Genera el Libro de Reportes de Gestión (3 pestañas limpias sin siglas R1/R2/R3 ni KPIs)
 */
export async function generatePayerFullBiWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NexoSalud Odontología';
  workbook.created = new Date();

  // ----- HOJA 1: RECAUDACIÓN Y CANALES -----
  const r1Query = `
    SELECT 
        Anio,
        Mes,
        NombreSede AS Sede,
        NombreServicio AS ServicioOdontologico,
        TipoMedio,
        MetodoPago AS Pasarela,
        EstadoPago,
        PagosRegistrados,
        PagosValidados,
        PagosPendientes,
        PagosRechazados,
        PagosRevertidos,
        IngresosBrutosRecaudados AS MontoRecaudado_PEN,
        CostoTransaccionPasarela AS ComisionPasarela_PEN
    FROM NexoSalud_Mart.dbo.v_ReporteR1_Recaudacion_Payer
    ORDER BY Anio DESC, Mes DESC, Sede, MetodoPago;
  `;
  const r1Rows: any[] = await prisma.$queryRawUnsafe(r1Query);
  const wsR1 = workbook.addWorksheet('Recaudación y Canales', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsR1.columns = [
    { header: 'Año', key: 'Anio', width: 8 },
    { header: 'Mes', key: 'Mes', width: 8 },
    { header: 'Sede Clínica', key: 'Sede', width: 22 },
    { header: 'Servicio Odontológico', key: 'ServicioOdontologico', width: 22 },
    { header: 'Tipo Medio', key: 'TipoMedio', width: 18 },
    { header: 'Pasarela / Método', key: 'Pasarela', width: 16 },
    { header: 'Estado Pago', key: 'EstadoPago', width: 14 },
    { header: 'Registrados', key: 'PagosRegistrados', width: 12 },
    { header: 'Validados', key: 'PagosValidados', width: 12 },
    { header: 'Pendientes', key: 'PagosPendientes', width: 12 },
    { header: 'Rechazados', key: 'PagosRechazados', width: 12 },
    { header: 'Revertidos', key: 'PagosRevertidos', width: 12 },
    { header: 'Recaudado (S/)', key: 'MontoRecaudado_PEN', width: 16 },
    { header: 'Comisión Pasarela (S/)', key: 'ComisionPasarela_PEN', width: 18 },
  ];
  applyHeaderStyle(wsR1.getRow(1), BRAND_COLORS.headerBiBg);
  r1Rows.forEach((r, idx) => {
    const row = wsR1.addRow({
      ...r,
      MontoRecaudado_PEN: Number(r.MontoRecaudado_PEN || 0),
      ComisionPasarela_PEN: Number(r.ComisionPasarela_PEN || 0),
    });
    styleDataRow(row, idx % 2 === 0);
    const mCell = row.getCell('MontoRecaudado_PEN');
    mCell.numFmt = '"S/" #,##0.00';
    mCell.alignment = { horizontal: 'right', vertical: 'middle' };
    const cCell = row.getCell('ComisionPasarela_PEN');
    cCell.numFmt = '"S/" #,##0.00';
    cCell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  wsR1.autoFilter = { from: { row: 1, column: 1 }, to: { row: r1Rows.length + 1, column: wsR1.columns.length } };
  autoFitColumns(wsR1);

  // ----- HOJA 2: TIEMPOS E INCIDENCIAS -----
  const r2Query = `
    SELECT 
        Anio,
        Mes,
        NombreSede AS Sede,
        MetodoPago AS Pasarela,
        TipoIncidencia,
        PrioridadIncidencia,
        MotivoEstandar AS MotivoRechazoIncidencia,
        CantidadIncidencias,
        PagosValidados,
        PagosRechazados,
        PagosRevertidos,
        TiempoPromedioMinutos
    FROM NexoSalud_Mart.dbo.v_ReporteR2_ValidacionIncidencias_Payer
    ORDER BY Anio DESC, Mes DESC, CantidadIncidencias DESC;
  `;
  const r2Rows: any[] = await prisma.$queryRawUnsafe(r2Query);
  const wsR2 = workbook.addWorksheet('Tiempos e Incidencias', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsR2.columns = [
    { header: 'Año', key: 'Anio', width: 8 },
    { header: 'Mes', key: 'Mes', width: 8 },
    { header: 'Sede Clínica', key: 'Sede', width: 22 },
    { header: 'Pasarela', key: 'Pasarela', width: 16 },
    { header: 'Tipo Incidencia', key: 'TipoIncidencia', width: 18 },
    { header: 'Prioridad', key: 'PrioridadIncidencia', width: 14 },
    { header: 'Motivo Tipificado de Rechazo', key: 'MotivoRechazoIncidencia', width: 32 },
    { header: 'Cantidad Incidencias', key: 'CantidadIncidencias', width: 16 },
    { header: 'Pagos Validados', key: 'PagosValidados', width: 14 },
    { header: 'Pagos Rechazados', key: 'PagosRechazados', width: 14 },
    { header: 'Pagos Revertidos', key: 'PagosRevertidos', width: 14 },
    { header: 'Tiempo Promedio (Minutos)', key: 'TiempoPromedioMinutos', width: 22 },
  ];
  applyHeaderStyle(wsR2.getRow(1), BRAND_COLORS.headerBg);
  r2Rows.forEach((r, idx) => {
    const row = wsR2.addRow({
      ...r,
      TiempoPromedioMinutos: Math.max(0, Number(r.TiempoPromedioMinutos || 0)),
    });
    styleDataRow(row, idx % 2 === 0);
    const tCell = row.getCell('TiempoPromedioMinutos');
    tCell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  wsR2.autoFilter = { from: { row: 1, column: 1 }, to: { row: r2Rows.length + 1, column: wsR2.columns.length } };
  autoFitColumns(wsR2);

  // ----- HOJA 3: CADENCIA Y CONVERSIÓN -----
  const r3Query = `
    SELECT 
        Anio,
        Mes,
        NombreSede AS Sede,
        NombreServicio AS ServicioOdontologico,
        EtapaCadencia AS EtapaCadenciaDunning,
        NivelRiesgoIA,
        ReservasPreagendadas,
        ReservasConfirmadas,
        SillonesLiberadosPorImpago,
        ConversionesACustomer,
        TasaEfectividad_Pct
    FROM NexoSalud_Mart.dbo.v_ReporteR3_CadenciaConversion_Payer
    ORDER BY Anio DESC, Mes DESC, Sede;
  `;
  const r3Rows: any[] = await prisma.$queryRawUnsafe(r3Query);
  const wsR3 = workbook.addWorksheet('Cadencia y Conversión', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsR3.columns = [
    { header: 'Año', key: 'Anio', width: 8 },
    { header: 'Mes', key: 'Mes', width: 8 },
    { header: 'Sede Clínica', key: 'Sede', width: 22 },
    { header: 'Servicio Odontológico', key: 'ServicioOdontologico', width: 22 },
    { header: 'Etapa Cadencia Dunning', key: 'EtapaCadenciaDunning', width: 24 },
    { header: 'Nivel Riesgo IA', key: 'NivelRiesgoIA', width: 16 },
    { header: 'Pre-reservas', key: 'ReservasPreagendadas', width: 14 },
    { header: 'Confirmadas', key: 'ReservasConfirmadas', width: 14 },
    { header: 'Sillones Liberados (00:00h)', key: 'SillonesLiberadosPorImpago', width: 22 },
    { header: 'Conversiones a CUSTOMER', key: 'ConversionesACustomer', width: 22 },
    { header: 'Tasa Efectividad (%)', key: 'TasaEfectividad_Pct', width: 18 },
  ];
  applyHeaderStyle(wsR3.getRow(1), BRAND_COLORS.headerBiBg);
  r3Rows.forEach((r, idx) => {
    const row = wsR3.addRow({
      ...r,
      TasaEfectividad_Pct: Number(r.TasaEfectividad_Pct || 0),
    });
    styleDataRow(row, idx % 2 === 0);
    const efCell = row.getCell('TasaEfectividad_Pct');
    efCell.numFmt = '0.00"%"';
    efCell.alignment = { horizontal: 'right', vertical: 'middle' };
  });
  wsR3.autoFilter = { from: { row: 1, column: 1 }, to: { row: r3Rows.length + 1, column: wsR3.columns.length } };
  autoFitColumns(wsR3);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

