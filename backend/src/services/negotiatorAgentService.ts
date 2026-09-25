export interface NegotiatorInput {
  leadId?: number;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  serviceName: string;
  branchName?: string;
  preferredSchedule?: string;
  category?: 'ESTUDIANTE' | 'CONVENIO' | 'CAMPANA' | 'REGULAR';
  customDiscountPercent?: number;
  customValidityHours?: number;
}

export interface NegotiatorStrategyResult {
  serviceName: string;
  branchName: string;
  originalPrice: number;
  offeredPrice: number;
  discountPercent: number;
  validityHours: number;
  validityDeadlineDate: string;
  benefitDescription: string;
  hookText: string;
  emailSubject: string;
  emailHtml: string;
  canvaData: {
    txt_servicio: string;
    txt_sede: string;
    txt_precio: string;
    txt_beneficio: string;
    txt_vigencia: string;
    txt_paciente: string;
  };
  reservationUrl: string;
}

class NegotiatorAgentService {
  /**
   * Genera la estrategia comercial personalizada y la redacción persuasiva para el prospecto
   */
  public generateStrategy(input: NegotiatorInput): NegotiatorStrategyResult {
    const frontendUrl = process.env.FRONTEND_URL || 'https://proyecto-in-odontologia.vercel.app';
    const patientFirstName = input.patientName.split(' ')[0] || 'Estimado(a)';
    const serviceName = input.serviceName || 'Consulta y Diagnóstico Odontológico Especializado';
    const branchName = input.branchName || 'Sede Principal NexoSalud';
    const schedule = input.preferredSchedule || 'Horario Flexible a Elección';

    // Determinar precio base estimado según el tratamiento
    let basePrice = 220;
    const lowerSvc = serviceName.toLowerCase();
    if (lowerSvc.includes('blanqueamiento')) basePrice = 280;
    else if (lowerSvc.includes('ortodoncia') || lowerSvc.includes('bracket')) basePrice = 350;
    else if (lowerSvc.includes('implante')) basePrice = 1200;
    else if (lowerSvc.includes('endodoncia')) basePrice = 320;
    else if (lowerSvc.includes('limpieza') || lowerSvc.includes('profilaxis')) basePrice = 120;
    else if (lowerSvc.includes('curación') || lowerSvc.includes('resina')) basePrice = 90;

    // Calcular descuento estratégico
    let discount = input.customDiscountPercent || 20;
    let benefitLabel = 'Evaluación Clínica Digital + 20% OFF de Bienvenida';

    if (input.category === 'ESTUDIANTE') {
      discount = 25;
      benefitLabel = 'Tarifa Universitaria Exclusiva (-25%) + Diagnóstico 3D';
    } else if (input.category === 'CONVENIO') {
      discount = 25;
      benefitLabel = 'Beneficio Alianza Corporativa (-25%) + Profilaxis Simple';
    } else if (input.category === 'CAMPANA') {
      discount = 30;
      benefitLabel = 'Campaña Sonrisa Saludable (-30% OFF)';
    }

    const offeredPrice = Math.round(basePrice * (1 - discount / 100));
    const validityHours = input.customValidityHours || (discount >= 30 ? 24 : 48);

    const deadline = new Date();
    deadline.setHours(deadline.getHours() + validityHours);
    const deadlineFormatted = deadline.toLocaleDateString('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    const reservationToken = `LEAD-${input.leadId || Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const reservationUrl = `${frontendUrl}/reservar?leadId=${input.leadId || ''}&token=${reservationToken}&service=${encodeURIComponent(serviceName)}&branch=${encodeURIComponent(branchName)}&price=${offeredPrice}`;

    const hookText = `¡${patientFirstName}, diseñamos un cupo exclusivo para tu tratamiento de ${serviceName} en ${branchName}!`;
    const emailSubject = `🦷 ${patientFirstName}, tu propuesta comercial exclusiva para ${serviceName} en NexoSalud`;

    const canvaData = {
      txt_servicio: serviceName.toUpperCase(),
      txt_sede: branchName.toUpperCase(),
      txt_precio: `S/ ${offeredPrice.toFixed(2)}`,
      txt_beneficio: benefitLabel.toUpperCase(),
      txt_vigencia: `Válido por ${validityHours}h (Hasta ${deadline.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })})`,
      txt_paciente: input.patientName,
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
      </head>
      <body style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado Institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, #042f2e 0%, #0d9488 100%); padding: 28px 32px; text-align: center;">
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 1px;">NEXOSALUD DENTAL</h1>
              <p style="color: #99f6e4; font-size: 13px; margin: 6px 0 0 0; font-weight: 500;">Propuesta Comercial Personalizada de Atención Odontológica</p>
            </td>
          </tr>

          <!-- Imagen Promocional Canva (Incrustada) -->
          <tr>
            <td style="padding: 24px 24px 10px 24px; text-align: center;">
              <img src="cid:canvaOfferImage" alt="Propuesta Comercial NexoSalud" style="width: 100%; max-width: 570px; border-radius: 12px; display: block; border: 1px solid #cbd5e1;" />
            </td>
          </tr>

          <!-- Cuerpo del Mensaje Persuasivo -->
          <tr>
            <td style="padding: 16px 32px 24px 32px;">
              <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin-top: 0;">¡Hola ${patientFirstName}! 👋</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 18px;">
                Sabemos lo importante que es para ti cuidar tu salud bucal y renovar tu sonrisa con total confianza. Nuestro equipo médico y comercial en <strong>${branchName}</strong> ha preparado una propuesta preferencial especialmente para ti.
              </p>

              <!-- Tarjeta Resumen de Oferta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%">
                      <tr>
                        <td style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase;">Tratamiento Ofertado:</td>
                        <td align="right" style="color: #0f172a; font-size: 14px; font-weight: 700;">${serviceName}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; padding-top: 8px;">Sede de Atención:</td>
                        <td align="right" style="color: #0f172a; font-size: 14px; font-weight: 600; padding-top: 8px;">${branchName}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; padding-top: 8px;">Horario Sugerido:</td>
                        <td align="right" style="color: #0d9488; font-size: 13px; font-weight: 600; padding-top: 8px;">${schedule}</td>
                      </tr>
                      <tr>
                        <td style="color: #e11d48; font-size: 12px; font-weight: bold; text-transform: uppercase; padding-top: 8px;">Precio Regular:</td>
                        <td align="right" style="color: #94a3b8; font-size: 13px; text-decoration: line-through; padding-top: 8px;">S/ ${basePrice.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="color: #0f766e; font-size: 14px; font-weight: 800; padding-top: 10px; border-top: 1px dashed #cbd5e1;">PRECIO EXCLUSIVO:</td>
                        <td align="right" style="color: #0d9488; font-size: 22px; font-weight: 900; padding-top: 10px; border-top: 1px dashed #cbd5e1;">S/ ${offeredPrice.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Alerta de Urgencia y Vigencia -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">
                  ⏰ <strong>Margen de Vigencia Activo:</strong> Esta tarifa congelada y beneficio adicional estarán garantizados hasta el <strong>${deadlineFormatted}</strong>.
                </p>
              </div>

              <!-- Botón de Acción Principal (CTA) -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <a href="${reservationUrl}" target="_blank" style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; display: inline-block; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);">
                  👉 Confirmar mi Promoción y Agendar Cita
                </a>
              </div>

              <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 12px;">
                (No requiere pago inmediato para reservar tu cupo con tarifa preferencial)
              </p>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                <strong>NexoSalud Red Odontológica Especializada</strong> • RUC: 20608945123<br/>
                Sedes en Trujillo (El Golf / Centro) y Lima (Miraflores / Surco) • Tel: (044) 283921
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return {
      serviceName,
      branchName,
      originalPrice: basePrice,
      offeredPrice,
      discountPercent: discount,
      validityHours,
      validityDeadlineDate: deadline.toISOString(),
      benefitDescription: benefitLabel,
      hookText,
      emailSubject,
      emailHtml,
      canvaData,
      reservationUrl,
    };
  }
}

export const negotiatorAgentService = new NegotiatorAgentService();
