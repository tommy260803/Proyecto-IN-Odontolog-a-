import nodemailer from 'nodemailer';
import { generateCanvaFlyer } from './canvaService';
import { prisma, withRetry } from '../db';
import dotenv from 'dotenv';

dotenv.config();

export interface NegotiatorDispatchRequest {
  leadId: number | string;
  patientName: string;
  email?: string;
  phone?: string;
  serviceName: string;
  sedeName: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  urgencyText?: string;
  benefitText?: string;
  persuasiveCopy?: string;
}

export interface NegotiatorDispatchResult {
  success: boolean;
  message: string;
  flyerUrl: string;
  emailSent: boolean;
  canvaSource: string;
  generatedCopy: string;
  details?: any;
}

/**
 * Agente Negociador Inteligente: Genera propuesta en Canva y despacha por correo electrónico.
 */
export async function executeNegotiatorAndDispatch(data: NegotiatorDispatchRequest): Promise<NegotiatorDispatchResult> {
  const numId = Number(data.leadId);
  const patient = data.patientName || 'Estimado(a) Paciente';
  const service = data.serviceName || 'Tratamiento Odontológico';
  const sede = data.sedeName || 'Sede Principal';
  const price = data.price || 150;
  const originalPrice = data.originalPrice || Math.round(price * 1.25);
  const discount = data.discountPercentage || 20;

  // 1. Redacción persuasiva del Agente de IA
  const persuasiveCopy = data.persuasiveCopy || 
    `¡Hola ${patient}! 🦷✨\n\n` +
    `Sabemos lo importante que es tu salud y estética dental. Hemos reservado una propuesta personalizada y preferencial para tu **${service}** en nuestra **${sede}**.\n\n` +
    `🏷️ **Inversión Preferencial:** S/ ${price} (Tarifa regular: S/ ${originalPrice}) — Ahorro del ${discount}%\n` +
    `🎁 **Beneficio Incluido:** ${data.benefitText || 'Evaluación digital con escáner 3D sin costo adicional'}.\n` +
    `⏳ **Vigencia Exclusiva:** ${data.urgencyText || 'Cupo reservado únicamente por las próximas 48 horas'}.\n\n` +
    `Adjuntamos tu credencial / flyer promocional personalizado. Para confirmar tu horario preferido con el especialista, pulsa el botón en el correo o responde a este mensaje.`;

  // 2. Generar Flyer con Canva Connect API (Autofill)
  const canvaResult = await generateCanvaFlyer({
    patientName: patient,
    serviceName: service,
    sedeName: sede,
    price,
    originalPrice,
    discountPercentage: discount,
    benefitText: data.benefitText || 'Evaluación 3D + Profilaxis de Regalo',
    urgencyText: data.urgencyText || 'Válido por 48 horas exclusivas'
  });

  // 3. Envío de Correo Electrónico con Nodemailer
  let emailSent = false;
  const recipientEmail = data.email;

  if (recipientEmail && recipientEmail.includes('@')) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'clinica.nexosalud.notificaciones@gmail.com',
          pass: process.env.EMAIL_PASS || 'demo-app-password',
        },
      });

      const reservationUrl = process.env.FRONTEND_URL 
        ? `${process.env.FRONTEND_URL}/portal-web` 
        : 'https://in-odontologia.vercel.app/portal-web';

      const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">NexoSalud Odontología</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Propuesta Comercial Personalizada</p>
          </div>
          <div style="padding: 24px;">
            <p style="font-size: 16px; color: #1e293b; font-weight: 600; margin-top: 0;">¡Hola ${patient}! 👋</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              El equipo de especialistas de NexoSalud ha preparado un plan exclusivo para ti para el servicio de <strong>${service}</strong> en nuestra <strong>${sede}</strong>.
            </p>
            
            <div style="text-align: center; margin: 20px 0;">
              <img src="${canvaResult.flyerUrl}" alt="Flyer Promocional Canva" style="width: 100%; max-width: 520px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1;" />
            </div>

            <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #0f172a;"><strong>💰 Precio Preferencial:</strong> S/ ${price} <span style="text-decoration: line-through; color: #94a3b8; font-size: 12px;">(S/ ${originalPrice})</span></p>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #0f172a;"><strong>🎁 Beneficio:</strong> ${data.benefitText || 'Evaluación 3D + Profilaxis incluida'}</p>
              <p style="margin: 0; font-size: 13px; color: #e11d48; font-weight: 600;"><strong>⏳ Vigencia:</strong> ${data.urgencyText || 'Cupo reservado por 48 horas'}</p>
            </div>

            <div style="text-align: center; margin: 30px 0 10px 0;">
              <a href="${reservationUrl}" target="_blank" style="background-color: #0d9488; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);">
                📅 Confirmar Mi Cita en Sede ${sede}
              </a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
            NexoSalud Clínica Odontológica · Sistema de Gestión Comercial Inteligente
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"NexoSalud Odontología" <${process.env.EMAIL_USER || 'no-reply@nexosalud.com'}>`,
        to: recipientEmail,
        subject: `🦷 Propuesta Personalizada: ${service} con tarifa preferencial en ${sede}`,
        text: persuasiveCopy,
        html: htmlContent,
      });

      emailSent = true;
      console.log(`✅ [Email Dispatch] Correo enviado exitosamente a ${recipientEmail}`);
    } catch (emailError: any) {
      console.warn(`⚠️ [Email Dispatch] No se pudo enviar el correo real (se registró en auditoría):`, emailError.message);
    }
  }

  // 4. Registrar en la base de datos como Interacción Comercial
  if (!isNaN(numId) && numId > 0) {
    try {
      await withRetry(async () => {
        const canalEmail = await prisma.canales.findFirst({ where: { nombre: { contains: 'Email' } } });
        await prisma.interacciones.create({
          data: {
            id_persona: numId,
            tipo: 'Oferta Canva & Negociación IA',
            mensaje: `[Agente Negociador] Enviado flyer Canva (${canvaResult.source}) con propuesta de S/ ${price} para ${service} en ${sede}. Email enviado: ${emailSent ? 'Sí' : 'No (Simulación)'}`,
            id_canal: canalEmail?.id_canal || 1,
          }
        });
      });
    } catch (dbErr: any) {
      console.warn('⚠️ Error al registrar interacción:', dbErr.message);
    }
  }

  return {
    success: true,
    message: emailSent 
      ? `¡Propuesta de Canva generada y enviada a ${recipientEmail} con éxito!` 
      : '¡Propuesta de Canva generada y guardada en el historial de negociación!',
    flyerUrl: canvaResult.flyerUrl,
    emailSent,
    canvaSource: canvaResult.source,
    generatedCopy: persuasiveCopy,
    details: canvaResult.details
  };
}
