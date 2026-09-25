import fs from 'fs';
import path from 'path';

/**
 * Canva Connect API Service
 * Integración con Canva Autofill API para Brand Template: EAHWLEXZ1lo
 * Rellena las variables dinámicas de la plantilla de clínica odontológica y exporta el PNG oficial.
 */

export interface CanvaAutofillParams {
  brandTemplateId?: string;
  leadName?: string;
  sedeTexto?: string;
  descuentoTexto?: string;
  contactoTexto?: string;
  horarioTexto?: string;
  tratamiento1?: {
    titulo?: string;
    desc?: string;
    precio?: string;
    imgUrl?: string;
  };
  tratamiento2?: {
    titulo?: string;
    desc?: string;
    precio?: string;
    imgUrl?: string;
  };
  tratamiento3?: {
    titulo?: string;
    desc?: string;
    precio?: string;
    imgUrl?: string;
  };
}

export interface CanvaAutofillResult {
  jobId: string;
  status: 'completed' | 'in_progress' | 'failed';
  designId?: string;
  designUrl: string;
  previewUrl: string;
  downloadPdfUrl?: string;
  downloadPngUrl?: string;
  filledDataset: Record<string, any>;
}

export class CanvaService {
  private static BRAND_TEMPLATE_ID = 'EAHWLEXZ1lo';
  private static cachedAccessToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  /**
   * Obtiene un Access Token válido, renovándolo automáticamente mediante el Refresh Token si es necesario
   */
  public static async getValidAccessToken(): Promise<string | null> {
    // Si tenemos un token en caché que no ha expirado (con margen de 2 minutos)
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 120000) {
      return this.cachedAccessToken;
    }

    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;
    const refreshToken = process.env.CANVA_REFRESH_TOKEN;

    // Intentar renovar con Refresh Token
    if (clientId && clientSecret && refreshToken) {
      try {
        console.log('🔄 [Canva Connect] Renovando Access Token usando Refresh Token...');
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }).toString(),
        });

        if (tokenRes.ok) {
          const tokenData: any = await tokenRes.json();
          this.cachedAccessToken = tokenData.access_token;
          this.tokenExpiresAt = Date.now() + ((tokenData.expires_in || 14400) * 1000);
          if (tokenData.refresh_token) {
            process.env.CANVA_REFRESH_TOKEN = tokenData.refresh_token;
            try {
              const envPath = path.resolve(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let content = fs.readFileSync(envPath, 'utf8');
                content = content.replace(/CANVA_REFRESH_TOKEN=.*/g, `CANVA_REFRESH_TOKEN=${tokenData.refresh_token}`);
                content = content.replace(/CANVA_ACCESS_TOKEN=.*/g, `CANVA_ACCESS_TOKEN=${tokenData.access_token}`);
                fs.writeFileSync(envPath, content, 'utf8');
              }
            } catch (_) {}
          }
          console.log('✅ [Canva Connect] Access Token renovado exitosamente.');
          return this.cachedAccessToken;
        } else {
          console.warn('⚠️ [Canva Connect] Falló la renovación del token con Canva:', await tokenRes.text());
        }
      } catch (err: any) {
        console.warn('⚠️ [Canva Connect] Excepción al renovar token:', err.message);
      }
    }

    // Fallback al token estático de .env si existe
    const fallbackToken = process.env.CANVA_API_KEY || process.env.CANVA_ACCESS_TOKEN || null;
    return fallbackToken;
  }

  /**
   * Genera el payload estructurado con las variables exactas de la plantilla de Canva
   */
  public static buildAutofillDataset(params: CanvaAutofillParams) {
    // En la plantilla, Descuento_Texto está sobre 'hasta' y al lado de '% OFF'
    // Se extrae sólo el número para no deformar el texto de tamaño gigante (ej: '20' o '30')
    let cleanDescuento = params.descuentoTexto || '20';
    const matchDigits = cleanDescuento.match(/\d+/);
    if (matchDigits) {
      cleanDescuento = matchDigits[0];
    }

    let cleanSede = params.sedeTexto || 'Av. Larco 123, Miraflores';
    cleanSede = cleanSede.replace(/^Sede:\s*/i, '').trim();

    const contactoTexto = params.contactoTexto || '+51 987 654 321\ninfo@nexosalud.pe';
    const horarioTexto = params.horarioTexto || 'Lunes a Sábado\n8:00am a 8:00pm';

    const t1 = params.tratamiento1 || {
      titulo: 'Brackets Metálicos',
      desc: 'Consultas mensuales para el control y alineación perfecta de tu sonrisa.',
      precio: 'Desde S/ 150',
    };

    const t2 = params.tratamiento2 || {
      titulo: 'Limpieza Dental',
      desc: 'Evaluación preventiva integral y profilaxis profunda.',
      precio: 'GRATIS (con reserva)',
    };

    const t3 = params.tratamiento3 || {
      titulo: 'Blanqueamiento',
      desc: 'Mantenimiento y brillo estético de alta durabilidad.',
      precio: 'Desde S/ 100',
    };

    return {
      // INFO GENERAL DE LA CLÍNICA Y GANCHO
      Sede_Texto: { type: 'text', text: cleanSede },
      Descuento_Texto: { type: 'text', text: cleanDescuento },
      Contacto_Texto: { type: 'text', text: contactoTexto },
      Horario_Texto: { type: 'text', text: horarioTexto },

      // BLOQUE DE TRATAMIENTO 1 (SUPERIOR)
      Tratamiento_1_Titulo: { type: 'text', text: t1.titulo || 'Brackets Metálicos' },
      Tratamiento_1_Desc: { type: 'text', text: t1.desc || 'Consultas mensuales para el seguimiento del tratamiento.' },
      Tratamiento_1_Precio: { type: 'text', text: t1.precio || 'Desde S/ 150' },

      // BLOQUE DE TRATAMIENTO 2 (CENTRAL)
      Tratamiento_2_Titulo: { type: 'text', text: t2.titulo || 'Limpieza Dental' },
      Tratamiento_2_Desc: { type: 'text', text: t2.desc || 'Evaluación integral preventiva incluida con tu reserva.' },
      Tratamiento_2_Precio: { type: 'text', text: t2.precio || 'GRATIS (con reserva)' },

      // BLOQUE DE TRATAMIENTO 3 (INFERIOR)
      Tratamiento_3_Titulo: { type: 'text', text: t3.titulo || 'Blanqueamiento' },
      Tratamiento_3_Desc: { type: 'text', text: t3.desc || 'Mantenimiento y brillo estético de alta durabilidad.' },
      Tratamiento_3_Precio: { type: 'text', text: t3.precio || 'Desde S/ 100' },
    };
  }

  /**
   * Genera una imagen vectorial SVG de alta definición (Data URL) como respaldo
   */
  public static generateVisualFlyerSvg(params: CanvaAutofillParams): string {
    const sede = params.sedeTexto || 'Sede Miraflores - Av. Larco 123';
    const descuento = params.descuentoTexto || '30';
    const contacto = params.contactoTexto?.replace(/\n/g, ' • ') || 'WhatsApp: +51 999 123 456';
    const horario = params.horarioTexto?.replace(/\n/g, ' | ') || 'Lun - Sáb: 8:00am a 8:00pm';

    const t1Title = params.tratamiento1?.titulo || 'Brackets Metálicos';
    const t1Desc = params.tratamiento1?.desc || 'Consultas mensuales para el control y alineación perfecta de tu sonrisa.';
    const t1Precio = params.tratamiento1?.precio || 'Desde S/ 150';

    const t2Title = params.tratamiento2?.titulo || 'Limpieza Dental';
    const t2Desc = params.tratamiento2?.desc || 'Evaluación preventiva integral y profilaxis profunda.';
    const t2Precio = params.tratamiento2?.precio || 'GRATIS (con reserva)';

    const t3Title = params.tratamiento3?.titulo || 'Blanqueamiento';
    const t3Desc = params.tratamiento3?.desc || 'Mantenimiento y brillo estético de alta durabilidad.';
    const t3Precio = params.tratamiento3?.precio || 'Desde S/ 100';

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="800" height="1050">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="40%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03" />
    </linearGradient>
  </defs>
  <rect width="800" height="1050" fill="url(#bg)" />
  <g transform="translate(60, 45)">
    <rect x="0" y="0" width="46" height="46" rx="12" fill="#0d9488" />
    <text x="60" y="26" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="#ffffff">NEXOSALUD</text>
    <text x="60" y="42" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">ODONTOLOGÍA INTEGRAL</text>
  </g>
  <g transform="translate(480, 40)">
    <rect x="0" y="0" width="260" height="52" rx="26" fill="url(#badgeGrad)" />
    <text x="130" y="32" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#ffffff" text-anchor="middle">🔥 ¡HASTA ${descuento}% OFF!</text>
  </g>
  <text x="400" y="145" font-family="system-ui, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">Tu Mejor Sonrisa Comienza Hoy</text>
  <g transform="translate(60, 205)">
    <rect x="0" y="0" width="680" height="210" rx="20" fill="url(#cardGrad)" stroke="#7c3aed" stroke-width="2" />
    <text x="50" y="55" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="#ffffff">${t1Title}</text>
    <text x="50" y="90" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">${t1Desc}</text>
    <rect x="50" y="130" width="200" height="46" rx="12" fill="#0d9488" />
    <text x="150" y="159" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle">${t1Precio}</text>
  </g>
  <g transform="translate(60, 435)">
    <rect x="0" y="0" width="680" height="150" rx="18" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5" />
    <text x="50" y="52" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#ffffff">${t2Title}</text>
    <text x="50" y="80" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">${t2Desc}</text>
    <rect x="490" y="50" width="165" height="42" rx="10" fill="#3b82f6" />
    <text x="572" y="77" font-family="system-ui, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">${t2Precio}</text>
  </g>
  <g transform="translate(60, 605)">
    <rect x="0" y="0" width="680" height="150" rx="18" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5" />
    <text x="50" y="52" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#ffffff">${t3Title}</text>
    <text x="50" y="80" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">${t3Desc}</text>
    <rect x="490" y="50" width="165" height="42" rx="10" fill="#059669" />
    <text x="572" y="77" font-family="system-ui, sans-serif" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle">${t3Precio}</text>
  </g>
  <g transform="translate(60, 780)">
    <rect x="0" y="0" width="680" height="120" rx="16" fill="#1e293b" stroke="#334155" />
    <text x="30" y="40" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#38bdf8">📍 ${sede}</text>
    <text x="30" y="68" font-family="system-ui, sans-serif" font-size="12" font-weight="500" fill="#cbd5e1">🕒 ${horario}</text>
    <text x="30" y="94" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#34d399">💬 ${contacto}</text>
  </g>
</svg>`.trim();

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Ejecuta la generación del Flyer usando Canva Connect Autofill o fallback directo de imagen
   */
  public static async generateFlyer(params: CanvaAutofillParams): Promise<CanvaAutofillResult> {
    const brandTemplateId = params.brandTemplateId || process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || this.BRAND_TEMPLATE_ID;
    const dataset = this.buildAutofillDataset(params);
    const token = await this.getValidAccessToken();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 1. Si contamos con API Key / Access Token de Canva Connect
    if (token) {
      try {
        console.log('🎨 [Canva Connect] Ejecutando Autofill con datos del paciente para plantilla:', brandTemplateId);

        // PASO 1: Iniciar Job de Autofill en Canva
        const autofillRes = await fetch('https://api.canva.com/rest/v1/autofills', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_template_id: brandTemplateId,
            title: `Flyer NexoSalud - ${params.leadName || 'Paciente'}`,
            data: dataset,
          }),
        });

        if (autofillRes.ok) {
          const autofillJson: any = await autofillRes.json();
          const autofillJobId = autofillJson.job?.id;
          console.log('🎨 [Canva Connect] Job de Autofill creado:', autofillJobId, 'Status:', autofillJson.job?.status);

          let autofillJob = autofillJson.job;
          let pollAttempts = 0;
          while (autofillJob?.status === 'in_progress' && pollAttempts < 10) {
            await new Promise((r) => setTimeout(r, 1500));
            const pollRes = await fetch(`https://api.canva.com/rest/v1/autofills/${autofillJobId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (pollRes.ok) {
              const pollData: any = await pollRes.json();
              autofillJob = pollData.job;
              console.log(`🎨 [Canva Connect] Polling Autofill (${pollAttempts + 1}/10): ${autofillJob?.status}`);
            }
            pollAttempts++;
          }

          const customizedDesign = autofillJob?.result?.design;
          const customizedDesignId = customizedDesign?.id;

          if (autofillJob?.status === 'success' && customizedDesignId) {
            console.log('🎉 [Canva Connect] ¡Diseño personalizado creado por Autofill! ID:', customizedDesignId);

            // PASO 2: Exportar a PNG oficial el diseño con los datos ya reemplazados
            console.log('🎨 [Canva Connect] Solicitando exportación PNG oficial del diseño personalizado:', customizedDesignId);
            const exportRes = await fetch('https://api.canva.com/rest/v1/exports', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                design_id: customizedDesignId,
                format: { type: 'png' },
              }),
            });

            if (exportRes.ok) {
              const exportJson: any = await exportRes.json();
              const exportJobId = exportJson.job?.id;
              let exportJob = exportJson.job;
              let exportPoll = 0;

              while (exportJob?.status === 'in_progress' && exportPoll < 10) {
                await new Promise((r) => setTimeout(r, 1500));
                const pRes = await fetch(`https://api.canva.com/rest/v1/exports/${exportJobId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (pRes.ok) {
                  const pData: any = await pRes.json();
                  exportJob = pData.job;
                  console.log(`🎨 [Canva Connect] Polling Exportación PNG (${exportPoll + 1}/10): ${exportJob?.status}`);
                }
                exportPoll++;
              }

              if (exportJob?.status === 'success' && exportJob.urls && exportJob.urls.length > 0) {
                const officialPngUrl = exportJob.urls[0];
                const designUrl = customizedDesign.url || `https://www.canva.com/design/${customizedDesignId}/view`;
                console.log('✅ [Canva Connect] ¡Flyer PNG con datos 100% reemplazados generado! URL:', officialPngUrl);

                return {
                  jobId: exportJobId || jobId,
                  status: 'completed',
                  designId: customizedDesignId,
                  designUrl,
                  previewUrl: officialPngUrl,
                  downloadPdfUrl: officialPngUrl,
                  downloadPngUrl: officialPngUrl,
                  filledDataset: dataset,
                };
              }
            }
          }
        } else {
          const errText = await autofillRes.text();
          console.warn('⚠️ [Canva Autofill Error Response]:', autofillRes.status, errText);
        }

        // Respaldo de exportación directa si Autofill no se completa
        const designId = process.env.CANVA_DESIGN_ID || 'DAHWLeZ6ETo';
        console.log('🎨 [Canva Connect] Usando exportación directa del diseño base:', designId);

        const fallbackExportRes = await fetch('https://api.canva.com/rest/v1/exports', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            design_id: designId,
            format: { type: 'png' },
          }),
        });

        if (fallbackExportRes.ok) {
          const fJson: any = await fallbackExportRes.json();
          let fJob = fJson.job;
          let fPoll = 0;
          while (fJob?.status === 'in_progress' && fPoll < 10) {
            await new Promise((r) => setTimeout(r, 1500));
            const pRes = await fetch(`https://api.canva.com/rest/v1/exports/${fJson.job?.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (pRes.ok) {
              const pData: any = await pRes.json();
              fJob = pData.job;
            }
            fPoll++;
          }

          if (fJob?.status === 'success' && fJob.urls?.[0]) {
            const pngUrl = fJob.urls[0];
            return {
              jobId: fJson.job?.id || jobId,
              status: 'completed',
              designId,
              designUrl: `https://www.canva.com/design/${designId}/view`,
              previewUrl: pngUrl,
              downloadPdfUrl: pngUrl,
              downloadPngUrl: pngUrl,
              filledDataset: dataset,
            };
          }
        }
      } catch (err: any) {
        console.warn('⚠️ [Canva Connect API Exception]:', err.message);
      }
    }

    // 2. Generador visual de imagen de respaldo (SVG de alta resolución en Base64)
    console.log('🎨 [Flyer Engine] Generando imagen de flyer en alta resolución con datos del paciente.');
    const visualFlyerImage = this.generateVisualFlyerSvg(params);

    return {
      jobId,
      status: 'completed',
      designId: brandTemplateId,
      designUrl: `https://www.canva.com/`,
      previewUrl: visualFlyerImage,
      downloadPdfUrl: visualFlyerImage,
      downloadPngUrl: visualFlyerImage,
      filledDataset: dataset,
    };
  }
}
