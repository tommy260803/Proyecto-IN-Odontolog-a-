import nodemailer from 'nodemailer';
import { CanvaService, CanvaAutofillParams } from './canvaService';

export interface DispatchNegotiationParams {
  leadId: number;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  serviceName: string;
  sedeName?: string;
  offeredPrice: number;
  originalPrice: number;
  discountPct: number;
  expirationDate: string;
  conditions?: string;
  canvaTemplateId?: string;
  sendEmail?: boolean;
}

export interface SendSimulationEmailParams {
  leadId: number;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  serviceName: string;
  sedeName?: string;
  offeredPrice: number;
  originalPrice: number;
  discountPct: number;
  expirationDate: string;
  conditions?: string;
  canvaFlyerUrl?: string;
  canvaDesignUrl?: string;
}

export class NegotiatorAgentService {
  /**
   * Envía un correo en modo simulación redirigido al correo del usuario/administrador
   * Si canvaFlyerUrl está presente, incrusta la imagen de Canva en HD; sino envía solo texto estilizado.
   */
  public static async sendSimulationOfferEmail(params: SendSimulationEmailParams) {
    const targetEmail = process.env.TEST_RECIPIENT_EMAIL || process.env.SMTP_USER || 'benkr7@gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER || 'benkr7@gmail.com',
        pass: process.env.SMTP_PASS || 'safmrpxkhkmgfdzg',
      },
    });

    const hasCanvaImage = Boolean(params.canvaFlyerUrl && params.canvaFlyerUrl.trim().length > 0);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
        <!-- Cabecera -->
        <div style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 26px 20px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.3px;">NexoSalud Odontología Especializada</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.92; font-size: 14px;">Propuesta Comercial Personalizada</p>
        </div>

        <div style="padding: 24px; color: #334155;">
          <!-- Banner de Simulación de Prueba -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 22px; font-size: 13px; color: #166534;">
            <p style="margin: 0 0 6px 0; font-weight: bold; display: flex; align-items: center; gap: 6px;">
              🧪 MODO SIMULACIÓN ACTIVO
            </p>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #15803d; line-height: 1.4;">
              Este correo fue enviado a tu bandeja de prueba (<strong>${targetEmail}</strong>) para validar el diseño y contenido antes del despacho al paciente.
            </p>
            <div style="border-top: 1px dashed #86efac; padding-top: 6px; margin-top: 6px; font-size: 11.5px; color: #166534;">
              <strong>👤 Paciente Destino:</strong> ${params.leadName} &nbsp;|&nbsp; 
              <strong>✉️ Correo Original:</strong> ${params.leadEmail || 'No asignado'} &nbsp;|&nbsp; 
              <strong>📱 Teléfono:</strong> ${params.leadPhone || 'No asignado'}
            </div>
          </div>

          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">¡Hola ${params.leadName}! 👋</h2>
          <p style="line-height: 1.5; font-size: 14px; margin-bottom: 16px;">
            Diseñamos una propuesta exclusiva para tu tratamiento de <strong>${params.serviceName}</strong> pensada a tu medida:
          </p>
          
          <!-- Tarjeta de Detalles de la Oferta -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 18px 0;">
            <div style="margin-bottom: 10px;">
              <span style="font-size: 12px; text-transform: uppercase; font-weight: bold; color: #64748b; letter-spacing: 0.5px;">Tarifa Promocional</span>
              <p style="margin: 2px 0 0 0; font-size: 22px; font-weight: bold; color: #0d9488;">
                S/ ${params.offeredPrice.toFixed(2)}
                <span style="font-size: 13px; font-weight: normal; color: #94a3b8; text-decoration: line-through; margin-left: 8px;">
                  S/ ${params.originalPrice.toFixed(2)}
                </span>
              </p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 12px; font-size: 13px;">
              <p style="margin: 3px 0;"><strong>🎁 Descuento:</strong> <span style="color: #059669; font-weight: bold;">${params.discountPct}% OFF</span></p>
              <p style="margin: 3px 0;"><strong>⏳ Vigencia:</strong> Hasta ${params.expirationDate}</p>
              <p style="margin: 3px 0;"><strong>📍 Sede:</strong> ${params.sedeName || 'Sede Principal'}</p>
              <p style="margin: 3px 0;"><strong>🛡️ Condiciones:</strong> ${params.conditions || 'Garantía clínica y cupo reservado'}</p>
            </div>
          </div>

          ${
            hasCanvaImage
              ? `<!-- Sección de Flyer Oficial Canva Incrustado -->
                 <div style="text-align: center; margin: 26px 0;">
                   <p style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                     🎨 Flyer Publicitario Oficial Canva
                   </p>
                   <img src="${params.canvaFlyerUrl}" alt="Flyer Publicitario NexoSalud" style="max-width: 100%; width: 440px; height: auto; border-radius: 14px; border: 1px solid #cbd5e1; box-shadow: 0 8px 24px rgba(0,0,0,0.12); display: inline-block;" />
                 </div>`
              : `<!-- Modo Solo Texto (Sin Flyer Generado) -->
                 <div style="background: #f1f5f9; border-left: 4px solid #0d9488; padding: 14px 16px; border-radius: 6px; margin: 22px 0;">
                   <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
                     💡 <em>Esta cotización personalizada ha sido elaborada especialmente según tu historial y preferencias. Puedes confirmar tu cita de inmediato comunicándote con nosotros.</em>
                   </p>
                 </div>`
          }

          <!-- Botones de Acción -->
          <div style="text-align: center; margin: 28px 0; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
            ${
              hasCanvaImage && params.canvaDesignUrl
                ? `<a href="${params.canvaDesignUrl}" target="_blank" style="background: #7c3aed; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px;">
                     🎨 Abrir en Canva
                   </a>`
                : ''
            }
            <a href="https://wa.me/51999123456?text=${encodeURIComponent(`Hola NexoSalud, confirmo mi cotización de ${params.serviceName} a S/ ${params.offeredPrice.toFixed(2)}`)}" target="_blank" style="background: #0d9488; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px; margin-left: 6px;">
              📅 Confirmar mi Turno
            </a>
          </div>

          <!-- Pie de Firma -->
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">NexoSalud Odontología Especializada • Atención de Lunes a Sábado de 08:00 AM a 08:00 PM</p>
            <p style="margin: 4px 0 0 0;">Si tienes alguna consulta adicional, responde a este correo o escríbenos por WhatsApp.</p>
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"NexoSalud Odontología" <${process.env.SMTP_USER || 'benkr7@gmail.com'}>`,
      to: targetEmail,
      subject: `[SIMULACIÓN] Propuesta Odontológica: ${params.serviceName} - Paciente: ${params.leadName}`,
      html: htmlContent,
    });

    return {
      success: true,
      recipient: targetEmail,
      messageId: info.messageId,
      hasCanvaImage,
      mode: 'simulation',
    };
  }

  /**
   * Genera el flyer dinámico en Canva y despacha la oferta por correo/WhatsApp
   */
  public static async processAndDispatch(params: DispatchNegotiationParams) {
    const brandTemplateId = params.canvaTemplateId || 'EAHWLEXZ1lo';

    // 1. Preparar datos para Canva Autofill con títulos cortos de máx 2 palabras y horario 12H
    const canvaParams: CanvaAutofillParams = {
      brandTemplateId,
      leadName: params.leadName,
      sedeTexto: `Sede: ${params.sedeName || 'Principal (Trujillo / Lima)'}`,
      descuentoTexto: `¡${params.discountPct}% DSCTO. EXCLUSIVO!`,
      contactoTexto: `WhatsApp: +51 999 123 456\ninfo@nexosalud.pe`,
      horarioTexto: `Lunes a Sábado\n08:00 AM - 08:00 PM`,
      tratamiento1: {
        titulo: params.serviceName || 'Ortodoncia Brackets',
        desc: params.conditions || 'Control mensual y garantía clínica.',
        precio: `Desde S/ ${params.offeredPrice.toFixed(2)}`,
        imgUrl: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80',
      },
      tratamiento2: {
        titulo: 'Limpieza Dental',
        desc: 'Profilaxis y diagnóstico digital 3D.',
        precio: 'GRATIS (con reserva)',
        imgUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
      },
      tratamiento3: {
        titulo: 'Blanqueamiento',
        desc: 'Brillo estético y mantenimiento.',
        precio: 'Desde S/ 100',
        imgUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=600&auto=format&fit=crop&q=80',
      },
    };

    // 2. Generar Flyer en Canva
    const canvaResult = await CanvaService.generateFlyer(canvaParams);

    // 3. Generar mensaje para WhatsApp
    const whatsAppMessage =
      `¡Hola ${params.leadName}! 👋 Te saludamos de NexoSalud Dental.\n\n` +
      `Te compartimos tu *Propuesta Comercial Personalizada* para *${params.serviceName}*:\n\n` +
      `💰 *Tarifa con Descuento:* S/ ${params.offeredPrice.toFixed(2)} (Ahorras ${params.discountPct}%)\n` +
      `⏳ *Vigencia de la oferta:* Hasta el ${params.expirationDate}\n` +
      `📍 *Sede:* ${params.sedeName || 'Sede Principal'}\n` +
      `🎨 *Tu Flyer Oficial en Canva:* ${canvaResult.designUrl}\n\n` +
      `Reserva tu turno ahora antes de que expire la tarifa promocional:\n` +
      `🔗 *https://nexosalud.pe/pre-reserva/${params.leadId}*`;

    let emailSent = false;
    let emailStatus = 'Not requested';

    // 4. Envío de Correo si se solicitó
    if (params.sendEmail) {
      try {
        const sendResult = await this.sendSimulationOfferEmail({
          leadId: params.leadId,
          leadName: params.leadName,
          leadEmail: params.leadEmail,
          leadPhone: params.leadPhone,
          serviceName: params.serviceName,
          sedeName: params.sedeName,
          offeredPrice: params.offeredPrice,
          originalPrice: params.originalPrice,
          discountPct: params.discountPct,
          expirationDate: params.expirationDate,
          conditions: params.conditions,
          canvaFlyerUrl: canvaResult.previewUrl,
          canvaDesignUrl: canvaResult.designUrl,
        });
        emailSent = sendResult.success;
        emailStatus = `Sent successfully (simulation to ${sendResult.recipient})`;
      } catch (e: any) {
        console.warn('⚠️ [Email Dispatch] Fallback en envío de correo:', e.message);
        emailStatus = `Simulation mode (${e.message})`;
      }
    }

    return {
      success: true,
      canva: canvaResult,
      whatsAppMessage,
      emailSent,
      emailStatus,
    };
  }
}
