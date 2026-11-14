import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import buyerRoutes from './routes/buyer.routes';
import leadRoutes from './routes/lead.routes';
import { leadFollowUpRouter } from './routes/leadFollowUp.routes';
import payerRoutes from './routes/payer.routes';
import paymentRoutes from './routes/payment.routes';
import customerRoutes from './routes/customer.routes';
import turnedRoutes from './routes/turned.routes';
import reportRoutes from './routes/report.routes';
import configRoutes from './routes/config.routes';
import patientAuthRoutes from './routes/patientAuth.routes';
import { canvaOAuthRouter } from './routes/canvaOAuth.routes';
import { startDunningScheduler } from './services/dunningScheduler';
import { leadWhatsAppWebhookRouter } from './routes/leadWhatsAppWebhook.routes';
import { startLeadWhatsAppChatbot } from './services/leadChatbot';
import { startWhatsAppFollowUps } from './services/leadWhatsAppAutomaticFollowUp';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use('/api/lead/whatsapp/webhook', leadWhatsAppWebhookRouter);
app.use(express.json());

// Registrar rutas
app.use('/api/buyer', buyerRoutes);
app.use('/api/lead/operational', leadFollowUpRouter);
app.use('/api/lead', leadRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payer', payerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/turned', turnedRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/mart', reportRoutes);
app.use('/api/config', configRoutes);
app.use('/api/patient-auth', patientAuthRoutes);
app.use('/api/canva', canvaOAuthRouter);

import { CanvaService } from './services/canvaService';

// Diagnóstico de Canva Connect en producción
app.get('/api/canva-diag', async (req, res) => {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const refreshToken = process.env.CANVA_REFRESH_TOKEN;
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const templateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID;

  let tokenCheck: any = null;
  try {
    const token = await CanvaService.getValidAccessToken();
    tokenCheck = {
      obtained: Boolean(token),
      tokenLength: token?.length,
    };
  } catch (e: any) {
    tokenCheck = { error: e.message };
  }

  res.json({
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenLength: refreshToken?.length,
    hasAccessToken: Boolean(accessToken),
    templateId,
    tokenCheck,
  });
});

app.get('/api/canva-dataset', async (req, res) => {
  try {
    const token = await CanvaService.getValidAccessToken();
    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo';
    const response = await fetch(`https://api.canva.com/rest/v1/brand-templates/${brandTemplateId}/dataset`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/canva-test-run', async (req, res) => {
  try {
    const token = await CanvaService.getValidAccessToken();
    if (!token) {
      return res.status(500).json({ error: 'No token obtained' });
    }

    const brandTemplateId = process.env.CANVA_BRAND_TEMPLATE_ID || process.env.CANVA_TEMPLATE_ID || 'EAHWLEXZ1lo';
    const dataset = CanvaService.buildAutofillDataset({
      sedeTexto: 'Sede Trujillo - El Golf',
      descuentoTexto: '30',
      contactoTexto: '+51 987 654 321\ninfo@nexosalud.pe',
      horarioTexto: 'Lunes a Sábado\n8:00am a 8:00pm',
      tratamiento1: {
        titulo: 'Ortodoncia Brackets',
        desc: 'Control mensual incluido',
        precio: 'Desde S/ 140.00',
      },
    });

    const autofillRes = await fetch('https://api.canva.com/rest/v1/autofills', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_template_id: brandTemplateId,
        title: 'Flyer NexoSalud - Diagnostic Run',
        data: dataset,
      }),
    });

    const autofillStatus = autofillRes.status;
    const autofillBody = await autofillRes.text();

    res.json({
      brandTemplateId,
      autofillStatus,
      autofillBody,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Ruta de prueba
app.get('/api/ping', async (req, res) => {
  try {
    // Intenta hacer una consulta muy simple para validar conexión a base de datos
    await prisma.$queryRaw`SELECT 1 as result`;
    res.json({ message: 'Pong! Conexión a la base de datos exitosa.', db: 'Connected' });
  } catch (error) {
    console.error('Error de conexión a la base de datos:', error);
    res.status(500).json({ message: 'Error conectando a la base de datos.', error });
  }
});

// Obtener todas las etapas
app.get('/api/etapas', async (req, res) => {
  try {
    const etapas = await prisma.etapas.findMany();
    res.json(etapas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener etapas' });
  }
});

app.listen(port, () => {
  console.log(`Servidor backend corriendo en http://localhost:${port}`);
  startDunningScheduler();
  startLeadWhatsAppChatbot();
  startWhatsAppFollowUps();
});
