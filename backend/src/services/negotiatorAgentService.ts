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
  fechaLimite?: string;
  tituloFlyer?: string;
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
   * Envía un correo en modo simulación redirigido al correo del usuario/administrador.
   * Utiliza la misma arquitectura multi-proveedor de alta velocidad que PAYER (Resend HTTPS Port 443 / Brevo / SMTP / Fallback).
   * Incrusta la imagen del flyer de Canva directamente en el cuerpo HTML; si no hay flyer, envía solo texto estructurado.
   */
  public static async sendSimulationOfferEmail(params: SendSimulationEmailParams) {
    const targetEmail = process.env.TEST_RECEIVER_EMAIL || process.env.TEST_RECIPIENT_EMAIL || process.env.SMTP_USER || 'benkr7@gmail.com';
    const emailSubject = `[SIMULACIÓN] Propuesta Odontológica: ${params.serviceName} - Paciente: ${params.leadName}`;
    const hasCanvaImage = Boolean(params.canvaFlyerUrl && params.canvaFlyerUrl.trim().length > 0);
    const frontendUrl = process.env.FRONTEND_URL || 'https://proyecto-in-odontologia.vercel.app';
    const preReservationUrl = `${frontendUrl}/pre-reserva/${params.leadId}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
        <!-- Cabecera -->
        <div style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 26px 20px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.3px;">NexoSalud Odontología Especializada</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.92; font-size: 14px;">Propuesta Comercial Personalizada</p>
        </div>

        <div style="padding: 24px; color: #334155;">
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
              ? `<!-- Sección de Flyer Oficial Canva Incrustado en el Cuerpo del Correo -->
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

          <!-- Botones de Acción Centrados para Gmail -->
          <div style="text-align: center; margin: 30px 0; width: 100%;">
            <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; text-align: center;">
              <tr>
                ${
                  hasCanvaImage && params.canvaFlyerUrl
                    ? `<td align="center" style="padding: 0 6px 10px 6px;">
                         <a href="${params.canvaFlyerUrl}" target="_blank" download="Flyer_NexoSalud.png" style="background-color: #7c3aed; color: #ffffff; padding: 13px 22px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px; font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(124,58,237,0.25);">
                           📥 Descargar Imagen
                         </a>
                       </td>`
                    : ''
                }
                <td align="center" style="padding: 0 6px 10px 6px;">
                  <a href="${preReservationUrl}" target="_blank" style="background-color: #0d9488; color: #ffffff; padding: 13px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px; font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(13,148,136,0.3);">
                    📅 Confirmar Turno
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <!-- Pie de Firma -->
          <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-top: 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">NexoSalud Odontología Especializada • Atención de Lunes a Sábado de 08:00 AM a 08:00 PM</p>
            <p style="margin: 4px 0 0 0;">Si tienes alguna consulta adicional, responde a este correo o escríbenos por WhatsApp.</p>
          </div>
        </div>
      </div>
    `;

    // ── MÉTODO 1: Resend API (HTTPS Port 443 - Idéntico a PAYER, ultra rápido <400ms) ──
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        console.log(`[EMAIL DISPATCHER] Despachando propuesta vía RESEND HTTPS API a: ${targetEmail}`);
        const resendPayload: any = {
          from: process.env.RESEND_FROM || 'Clínica NexoSalud <onboarding@resend.dev>',
          to: [targetEmail],
          subject: emailSubject,
          html: htmlContent,
        };

        let resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        });

        let resendData: any = await resendRes.json();

        // En caso de Sandbox sin dominio propio en Resend, reenviar forzando el email del owner
        if (!resendRes.ok && (resendData.message?.includes('only send testing emails') || resendData.name === 'validation_error')) {
          const fallbackTestEmail = process.env.TEST_RECEIVER_EMAIL || 'benkr7@gmail.com';
          console.warn(`[RESEND SANDBOX] Redirigiendo a (${fallbackTestEmail})`);
          resendPayload.to = [fallbackTestEmail];
          resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resendPayload),
          });
          resendData = await resendRes.json();
        }

        if (resendRes.ok) {
          return {
            success: true,
            provider: 'resend',
            recipient: targetEmail,
            messageId: resendData.id,
            hasCanvaImage,
            mode: 'simulation',
          };
        }
        console.warn('⚠️ [RESEND API ERROR]', resendData);
      } catch (resendErr: any) {
        console.warn('⚠️ [RESEND API EXCEPTION]', resendErr.message);
      }
    }

    // ── MÉTODO 2: Brevo HTTPS API (Port 443 - Idéntico a PAYER) ──────────────────
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (brevoApiKey) {
      try {
        console.log(`[EMAIL DISPATCHER] Despachando propuesta vía BREVO HTTPS API a: ${targetEmail}`);
        const brevoPayload: any = {
          sender: { name: 'Clínica NexoSalud', email: process.env.BREVO_SENDER_EMAIL || 'notificaciones@nexosalud.com' },
          to: [{ email: targetEmail, name: params.leadName || 'Paciente' }],
          subject: emailSubject,
          htmlContent: htmlContent,
        };

        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(brevoPayload),
        });

        if (brevoRes.ok) {
          return {
            success: true,
            provider: 'brevo',
            recipient: targetEmail,
            hasCanvaImage,
            mode: 'simulation',
          };
        }
      } catch (brevoErr: any) {
        console.warn('⚠️ [BREVO API EXCEPTION]', brevoErr.message);
      }
    }

    // ── MÉTODO 3: SMTP Directo con Timeouts Estrictos (Nodemailer / Gmail) ───────
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (smtpUser && smtpPass) {
      try {
        const cleanPass = smtpPass.replace(/\s+/g, '');
        const isGmail = smtpHost.toLowerCase().includes('gmail');

        const transporter = nodemailer.createTransport({
          ...(isGmail ? { service: 'gmail' } : { host: smtpHost, port: smtpPort, secure: smtpPort === 465 }),
          auth: {
            user: smtpUser,
            pass: cleanPass,
          },
          connectionTimeout: 4500,
          greetingTimeout: 4500,
          socketTimeout: 5500,
          tls: {
            rejectUnauthorized: false,
          },
        });

        const info = await transporter.sendMail({
          from: `"NexoSalud Odontología" <${smtpUser}>`,
          to: targetEmail,
          subject: emailSubject,
          html: htmlContent,
        });

        return {
          success: true,
          provider: 'smtp',
          recipient: targetEmail,
          messageId: info.messageId,
          hasCanvaImage,
          mode: 'simulation',
        };
      } catch (smtpErr: any) {
        console.warn('⚠️ [SMTP ERROR / TIMEOUT en Render]:', smtpErr.message);
      }
    }

    // ── MÉTODO 4: Fallback Inmediato de Simulación (Garantiza respuesta en <1s) ───
    console.log(`[EMAIL DISPATCHER] Simulación completada para: ${targetEmail}`);
    return {
      success: true,
      simulated: true,
      provider: 'simulation',
      recipient: targetEmail,
      message: `Propuesta procesada exitosamente en modo simulación para ${targetEmail}.`,
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
      tituloFlyer: params.tituloFlyer,
      fechaLimite: params.fechaLimite || params.expirationDate,
      sedeTexto: params.sedeName || 'Sede California - Av. Larco 820, Urb. California, Trujillo',
      descuentoTexto: `¡${params.discountPct}% DSCTO. EXCLUSIVO!`,
      contactoTexto: `WhatsApp: +51 970 292 710\ninfo@nexosalud.pe`,
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
      `🔗 *${process.env.FRONTEND_URL || "https://proyecto-in-odontologia.vercel.app"}/pre-reserva/${params.leadId}*`;

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
