import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import buyerRoutes from './routes/buyer.routes';
import leadRoutes from './routes/lead.routes';
import payerRoutes from './routes/payer.routes';
import paymentRoutes from './routes/payment.routes';
import customerRoutes from './routes/customer.routes';
import turnedRoutes from './routes/turned.routes';
import reportRoutes from './routes/report.routes';
import { startDunningScheduler } from './services/dunningScheduler';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Registrar rutas
app.use('/api/buyer', buyerRoutes);
app.use('/api/lead', leadRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payer', payerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/turned', turnedRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/mart', reportRoutes);

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
});
