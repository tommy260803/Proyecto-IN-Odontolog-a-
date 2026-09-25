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

export class NegotiatorAgentService {
  /**
   * Genera el flyer dinámico en Canva y despacha la oferta por correo/WhatsApp
   */
  public static async processAndDispatch(params: DispatchNegotiationParams) {
    const brandTemplateId = params.canvaTemplateId || 'EAHWLEXZ1lo';

    // 1. Preparar datos para Canva Autofill
    const canvaParams: CanvaAutofillParams = {
      brandTemplateId,
      leadName: params.leadName,
      sedeTexto: params.sedeName || 'Av. Larco 123, Miraflores',
      descuentoTexto: String(params.discountPct || 20),
      contactoTexto: '+51 987 654 321\ninfo@nexosalud.pe',
      horarioTexto: 'Lunes a Sábado\n8:00am a 8:00pm',
      tratamiento1: {
        titulo: params.serviceName || 'Tratamiento Odontológico',
        desc: params.conditions || 'Promoción personalizada con garantía clínica NexoSalud.',
        precio: `Desde S/ ${params.offeredPrice.toFixed(2)}`,
        imgUrl: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&auto=format&fit=crop&q=80',
      },
      tratamiento2: {
        titulo: 'Limpieza y Diagnóstico Digital 3D',
        desc: 'Evaluación integral preventiva incluida con tu reserva.',
        precio: 'GRATIS (con tu reserva)',
        imgUrl: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80',
      },
      tratamiento3: {
        titulo: 'Retenedores & Blanqueamiento',
        desc: 'Mantenimiento y brillo estético de alta durabilidad.',
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

    // 4. Envío de Correo si se solicitó y existe correo
    if (params.sendEmail && params.leadEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.ethereal.email',
          port: Number(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER || 'nexosalud.dental@ethereal.email',
            pass: process.env.SMTP_PASS || 'secret',
          },
        });

        await transporter.sendMail({
          from: '"NexoSalud Odontología" <promociones@nexosalud.pe>',
          to: params.leadEmail,
          subject: `✨ Propuesta Exclusiva para ${params.leadName} - ${params.serviceName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%); padding: 24px; color: white; text-align: center;">
                <h1 style="margin: 0; font-size: 22px;">NexoSalud Odontología Especializada</h1>
                <p style="margin: 8px 0 0 0; opacity: 0.9;">Propuesta Comercial Personalizada</p>
              </div>
              <div style="padding: 24px; color: #334155;">
                <h2 style="color: #0f172a; font-size: 18px;">¡Hola ${params.leadName}!</h2>
                <p>Diseñamos una propuesta exclusiva para tu tratamiento de <strong>${params.serviceName}</strong>:</p>
                
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 4px 0; font-size: 16px; color: #0d9488;"><strong>Tarifa Promocional: S/ ${params.offeredPrice.toFixed(2)}</strong> <span style="font-size: 13px; color: #64748b;">(Normal: S/ ${params.originalPrice.toFixed(2)})</span></p>
                  <p style="margin: 4px 0;"><strong>Descuento Aplicado:</strong> ${params.discountPct}% OFF</p>
                  <p style="margin: 4px 0;"><strong>Vigencia:</strong> Hasta ${params.expirationDate}</p>
                  <p style="margin: 4px 0;"><strong>Sede:</strong> ${params.sedeName || 'Sede Principal'}</p>
                </div>

                <!-- Flyer Publicitario de Canva Incrustado -->
                <div style="text-align: center; margin: 24px 0;">
                  <p style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                    🎨 Tu Flyer Publicitario Oficial Canva
                  </p>
                  <img src="${canvaResult.previewUrl}" alt="Flyer Publicitario NexoSalud" style="max-width: 100%; width: 440px; height: auto; border-radius: 16px; border: 1px solid #cbd5e1; box-shadow: 0 8px 24px rgba(0,0,0,0.12); display: inline-block;" />
                </div>

                <div style="text-align: center; margin: 24px 0; display: flex; gap: 10px; justify-content: center;">
                  <a href="${canvaResult.designUrl}" target="_blank" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px;">
                    🎨 Ver y Editar en Canva
                  </a>
                  <a href="https://nexosalud.pe/pre-reserva/${params.leadId}" target="_blank" style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 13px; margin-left: 8px;">
                    📅 Confirmar mi Turno
                  </a>
                </div>
              </div>
            </div>
          `,
        });
        emailSent = true;
        emailStatus = 'Sent successfully';
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
