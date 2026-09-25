import dotenv from 'dotenv';
dotenv.config();

export interface CanvaDatasetItem {
  type: 'text';
  text: string;
}

export interface CanvaAutofillData {
  txt_servicio?: string;
  txt_sede?: string;
  txt_precio?: string;
  txt_beneficio?: string;
  txt_vigencia?: string;
  txt_paciente?: string;
  [key: string]: string | undefined;
}

export interface CanvaExportResult {
  imageUrl: string;
  imageBuffer?: Buffer;
  imageBase64?: string;
  isFallback?: boolean;
}

class CanvaService {
  private clientId: string;
  private clientSecret: string;
  private templateId: string;
  private directAccessToken: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.CANVA_CLIENT_ID || '';
    this.clientSecret = process.env.CANVA_CLIENT_SECRET || '';
    this.templateId = process.env.CANVA_TEMPLATE_ID || process.env.CANVA_BRAND_TEMPLATE_ID || '';
    this.directAccessToken = process.env.CANVA_API_KEY || process.env.CANVA_ACCESS_TOKEN || '';
  }

  /**
   * Obtiene o renueva el token de acceso de Canva Connect API
   */
  private async getAccessToken(): Promise<string | null> {
    if (this.directAccessToken && !this.directAccessToken.includes('tu_')) {
      return this.directAccessToken;
    }

    if (!this.clientId || !this.clientSecret || this.clientId.includes('tu_')) {
      return null;
    }

    // Token en caché válido
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[CanvaService] No se pudo obtener token OAuth (${response.status}):`, errorText);
        return null;
      }

      const tokenData = await response.json();
      if (tokenData.access_token) {
        this.cachedToken = tokenData.access_token;
        this.tokenExpiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
        return this.cachedToken;
      }
      return null;
    } catch (error) {
      console.warn('[CanvaService] Error al conectar con Canva OAuth:', error);
      return null;
    }
  }

  /**
   * Genera una imagen promocional personalizada usando Canva Connect API (Autofill)
   * Si las credenciales no son válidas o la API falla, usa el motor de renderizado gráfico de respaldo.
   */
  public async generateOfferImage(data: CanvaAutofillData): Promise<CanvaExportResult> {
    const templateId = this.templateId;
    const token = await this.getAccessToken();

    if (token && templateId && !templateId.includes('tu_')) {
      try {
        console.log('[CanvaService] Iniciando Autofill con plantilla:', templateId);

        // 1. Crear dataset formateado según Canva Connect API
        const formattedDataset: Record<string, CanvaDatasetItem> = {};
        for (const [key, value] of Object.entries(data)) {
          if (value) {
            formattedDataset[key] = {
              type: 'text',
              text: String(value),
            };
          }
        }

        // 2. Crear Job de Autofill
        const autofillRes = await fetch('https://api.canva.com/rest/v1/autofills', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_template_id: templateId,
            title: `Oferta_${data.txt_servicio || 'Dental'}_${Date.now()}`,
            data: formattedDataset,
          }),
        });

        if (autofillRes.ok) {
          const autofillJson = await autofillRes.json();
          const jobId = autofillJson?.job?.id;

          if (jobId) {
            // 3. Polling del Job de Autofill
            const designId = await this.pollAutofillJob(jobId, token);
            if (designId) {
              // 4. Crear Job de Exportación a PNG
              const exportUrl = await this.exportDesignToPng(designId, token);
              if (exportUrl) {
                console.log('[CanvaService] ¡Imagen generada exitosamente por Canva Connect API! URL:', exportUrl);
                const imgRes = await fetch(exportUrl);
                const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                return {
                  imageUrl: exportUrl,
                  imageBuffer: imgBuffer,
                  imageBase64: imgBuffer.toString('base64'),
                  isFallback: false,
                };
              }
            }
          }
        } else {
          console.warn('[CanvaService] Respuesta no exitosa de Autofill:', await autofillRes.text());
        }
      } catch (err) {
        console.warn('[CanvaService] Error durante llamada a Canva Connect API, utilizando generador de respaldo:', err);
      }
    } else {
      console.log('[CanvaService] Credenciales de Canva ausentes o de plantilla. Utilizando motor gráfico de marca NexoSalud.');
    }

    // Generador gráfico de marca de alta fidelidad (Fallback)
    return this.generateBrandedFallbackImage(data);
  }

  private async pollAutofillJob(jobId: string, token: string): Promise<string | null> {
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await fetch(`https://api.canva.com/rest/v1/autofills/${jobId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.job?.status === 'success') {
          return json?.job?.result?.design?.id || null;
        }
        if (json?.job?.status === 'failed') {
          console.warn('[CanvaService] Autofill job falló:', json?.job?.error);
          return null;
        }
      }
    }
    return null;
  }

  private async exportDesignToPng(designId: string, token: string): Promise<string | null> {
    const res = await fetch('https://api.canva.com/rest/v1/exports', {
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

    if (!res.ok) return null;
    const json = await res.json();
    const exportJobId = json?.job?.id;
    if (!exportJobId) return null;

    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(`https://api.canva.com/rest/v1/exports/${exportJobId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (pollRes.ok) {
        const pollJson = await pollRes.json();
        if (pollJson?.job?.status === 'success' && pollJson?.job?.urls?.length) {
          return pollJson.job.urls[0];
        }
      }
    }
    return null;
  }

  /**
   * Generador Gráfico de Respaldo: Genera un banner SVG vectorial de alta resolución y lo convierte a Base64
   */
  private generateBrandedFallbackImage(data: CanvaAutofillData): CanvaExportResult {
    const servicio = (data.txt_servicio || 'Consulta Odontológica').toUpperCase();
    const sede = data.txt_sede || 'Sede Principal NexoSalud';
    const precio = data.txt_precio || 'S/ 149.00';
    const beneficio = data.txt_beneficio || 'Promoción Exclusiva + Evaluación Integral';
    const vigencia = data.txt_vigencia || 'Válido por 48 horas';
    const paciente = data.txt_paciente || 'Paciente Preferencial';

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#042f2e" />
          <stop offset="50%" stop-color="#0f766e" />
          <stop offset="100%" stop-color="#0d9488" />
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.25" />
        </filter>
      </defs>

      <!-- Fondo Degradado NexoSalud -->
      <rect width="900" height="500" rx="24" fill="url(#bg)" />

      <!-- Formas de Diseño de Marca -->
      <circle cx="850" cy="50" r="180" fill="#14b8a6" opacity="0.15" />
      <circle cx="50" cy="450" r="140" fill="#2dd4bf" opacity="0.12" />

      <!-- Badge de Encabezado Oficial -->
      <rect x="50" y="45" width="220" height="34" rx="17" fill="#ffffff" opacity="0.18" />
      <text x="65" y="68" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="bold" fill="#5eead4" letter-spacing="1.5">✦ NEXOSALUD DENTAL</text>

      <!-- Badge de Exclusividad -->
      <rect x="630" y="45" width="220" height="34" rx="17" fill="url(#gold)" />
      <text x="740" y="68" text-anchor="middle" font-family="'Helvetica Neue', Arial, sans-serif" font-size="13" font-weight="bold" fill="#042f2e" letter-spacing="1">OFERTA PREFERENCIAL</text>

      <!-- Título del Servicio -->
      <text x="50" y="145" font-family="'Helvetica Neue', Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="-0.5">${servicio}</text>
      
      <!-- Subtítulo personalizado -->
      <text x="50" y="180" font-family="'Helvetica Neue', Arial, sans-serif" font-size="17" font-weight="500" fill="#ccfbf1">Preparado exclusivamente para: <tspan font-weight="bold" fill="#ffffff">${paciente}</tspan></text>

      <!-- Tarjeta Central de Precio y Beneficios -->
      <rect x="50" y="215" width="800" height="185" rx="20" fill="#ffffff" filter="url(#shadow)" />

      <!-- Columna Izquierda: Precio Ofertado -->
      <rect x="75" y="235" width="260" height="145" rx="16" fill="#f0fdfa" />
      <text x="95" y="265" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f766e" letter-spacing="1">PRECIO ESPECIAL ACORDADO</text>
      <text x="95" y="325" font-family="'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="900" fill="#0d9488">${precio}</text>
      <text x="95" y="355" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12" font-weight="bold" fill="#e11d48">✓ Cupo con Tarifa Congelada</text>

      <!-- Columna Derecha: Beneficios y Sede -->
      <text x="365" y="260" font-family="'Helvetica Neue', Arial, sans-serif" font-size="18" font-weight="bold" fill="#0f172a">Detalles y Garantía Clínica:</text>
      
      <circle cx="375" cy="290" r="5" fill="#0d9488" />
      <text x="395" y="295" font-family="'Helvetica Neue', Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f766e">${beneficio}</text>

      <circle cx="375" cy="325" r="5" fill="#0d9488" />
      <text x="395" y="330" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" fill="#334155">Atención en: <tspan font-weight="bold" fill="#0f172a">${sede}</tspan></text>

      <circle cx="375" cy="360" r="5" fill="#f59e0b" />
      <text x="395" y="365" font-family="'Helvetica Neue', Arial, sans-serif" font-size="13" font-weight="bold" fill="#d97706">⏰ ${vigencia}</text>

      <!-- Barra Inferior de Garantía -->
      <text x="50" y="445" font-family="'Helvetica Neue', Arial, sans-serif" font-size="13" font-weight="500" fill="#99f6e4">✓ Bioseguridad Grado Hospitalario • ✓ Especialistas Colegiados • ✓ Sedes en Lima y Trujillo</text>
    </svg>
    `;

    const imageBuffer = Buffer.from(svg, 'utf-8');
    const imageBase64 = imageBuffer.toString('base64');
    const imageUrl = `data:image/svg+xml;base64,${imageBase64}`;

    return {
      imageUrl,
      imageBuffer,
      imageBase64,
      isFallback: true,
    };
  }
}

export const canvaService = new CanvaService();
