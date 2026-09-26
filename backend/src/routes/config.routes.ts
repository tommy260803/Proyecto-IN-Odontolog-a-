import { Router } from 'express';
import { prisma } from '../db';
import fs from 'fs';
import path from 'path';

const router = Router();

// Ruta del archivo de persistencia para datos institucionales de la empresa
const CONFIG_FILE_PATH = path.resolve(__dirname, '../../data/clinicConfig.json');

const DEFAULT_COMPANY_CONFIG = {
  nombreComercial: 'NexoSalud Odontología Especializada',
  razonSocial: 'NexoSalud Dental S.A.C.',
  ruc: '20608945123',
  telefonoPrincipal: '+51 970 292 710',
  emailContacto: 'contacto@nexosalud.pe',
  direccionFiscal: 'Av. Larco 820, Urb. California, Trujillo - La Libertad',
  slogan: 'Red Odontológica Integral de Alta Complejidad',
  horarioAtencion: 'Lunes a Sábado: 08:00 AM - 08:00 PM',
  sitioWeb: 'https://proyecto-in-odontologia.vercel.app',
  ciudadPrincipal: 'Trujillo, Perú',
  metodologia: 'IMPULSE Business Intelligence 360',
};

function getStoredCompanyConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return { ...DEFAULT_COMPANY_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.warn('Error reading clinicConfig.json, using defaults:', err);
  }
  return DEFAULT_COMPANY_CONFIG;
}

function saveCompanyConfig(data: any) {
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving clinicConfig.json:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. EMPRESA / CLÍNICA
// ─────────────────────────────────────────────────────────────
router.get('/empresa', (req, res) => {
  res.json(getStoredCompanyConfig());
});

router.put('/empresa', (req, res) => {
  try {
    const current = getStoredCompanyConfig();
    const updated = { ...current, ...req.body };
    saveCompanyConfig(updated);
    res.json({ success: true, empresa: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al guardar configuración de empresa' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. SERVICIOS Y TARIFAS
// ─────────────────────────────────────────────────────────────
router.get('/servicios', async (req, res) => {
  try {
    const servicios = await prisma.servicios.findMany({
      include: {
        Tarifas: {
          where: { activo: true },
          orderBy: { fecha_inicio: 'desc' },
          take: 1,
        },
        ProfesionalServicio: {
          include: {
            Profesional: {
              select: { id_profesional: true, nombres: true, apellidos: true, especialidad: true },
            },
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });

    const formatted = servicios.map((s) => ({
      id_servicio: s.id_servicio,
      nombre: s.nombre,
      descripcion: s.descripcion || '',
      activo: s.activo,
      precio: s.Tarifas[0] ? Number(s.Tarifas[0].precio) : null,
      id_tarifa: s.Tarifas[0]?.id_tarifa || null,
      especialistas: s.ProfesionalServicio.map((ps) => `${ps.Profesional.nombres} ${ps.Profesional.apellidos}`),
    }));

    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching servicios:', err);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
});

router.post('/servicios', async (req, res) => {
  try {
    const { nombre, descripcion, precio, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre del servicio es obligatorio' });

    const newServicio = await prisma.servicios.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    if (precio && !isNaN(Number(precio))) {
      await prisma.tarifas.create({
        data: {
          id_servicio: newServicio.id_servicio,
          precio: Number(precio),
          activo: true,
        },
      });
    }

    res.status(201).json(newServicio);
  } catch (err: any) {
    console.error('Error creating servicio:', err);
    res.status(500).json({ error: err.message || 'Error al crear servicio' });
  }
});

router.put('/servicios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, precio, activo } = req.body;

    const updated = await prisma.servicios.update({
      where: { id_servicio: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    if (precio !== undefined && !isNaN(Number(precio))) {
      // Desactivar tarifas previas y crear nueva tarifa vigente
      await prisma.tarifas.updateMany({
        where: { id_servicio: id, activo: true },
        data: { activo: false, fecha_fin: new Date() },
      });

      await prisma.tarifas.create({
        data: {
          id_servicio: id,
          precio: Number(precio),
          activo: true,
        },
      });
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating servicio:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar servicio' });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. SEDES
// ─────────────────────────────────────────────────────────────
router.get('/sedes', async (req, res) => {
  try {
    const sedes = await prisma.sedes.findMany({
      orderBy: [{ activo: 'desc' }, { id_sede: 'asc' }],
    });
    res.json(sedes);
  } catch (err: any) {
    console.error('Error fetching sedes:', err);
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

router.post('/sedes', async (req, res) => {
  try {
    const { nombre, direccion, zona, activo } = req.body;
    if (!nombre || !direccion) {
      return res.status(400).json({ error: 'Nombre y dirección son obligatorios' });
    }

    const newSede = await prisma.sedes.create({
      data: {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        zona: zona?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    res.status(201).json(newSede);
  } catch (err: any) {
    console.error('Error creating sede:', err);
    res.status(500).json({ error: err.message || 'Error al crear sede' });
  }
});

router.put('/sedes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, direccion, zona, activo } = req.body;

    const updated = await prisma.sedes.update({
      where: { id_sede: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(direccion !== undefined && { direccion: direccion.trim() }),
        ...(zona !== undefined && { zona: zona.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating sede:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar sede' });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. PROFESIONALES / ESPECIALISTAS
// ─────────────────────────────────────────────────────────────
router.get('/profesionales', async (req, res) => {
  try {
    const profesionales = await prisma.profesionales.findMany({
      include: {
        ProfesionalServicio: {
          include: {
            Servicio: {
              select: { id_servicio: true, nombre: true },
            },
          },
        },
      },
      orderBy: [{ activo: 'desc' }, { id_profesional: 'asc' }],
    });

    const formatted = profesionales.map((p) => ({
      id_profesional: p.id_profesional,
      nombres: p.nombres,
      apellidos: p.apellidos,
      numero_colegiatura: p.numero_colegiatura || '',
      especialidad: p.especialidad || 'Odontología General',
      activo: p.activo,
      servicios: p.ProfesionalServicio.map((ps) => ps.Servicio),
    }));

    res.json(formatted);
  } catch (err: any) {
    console.error('Error fetching profesionales:', err);
    res.status(500).json({ error: 'Error al obtener especialistas' });
  }
});

router.post('/profesionales', async (req, res) => {
  try {
    const { nombres, apellidos, numero_colegiatura, especialidad, activo, serviciosIds } = req.body;
    if (!nombres || !apellidos) {
      return res.status(400).json({ error: 'Nombres y apellidos son obligatorios' });
    }

    const newProf = await prisma.profesionales.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        numero_colegiatura: numero_colegiatura?.trim() || null,
        especialidad: especialidad?.trim() || 'Odontología General',
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    if (Array.isArray(serviciosIds) && serviciosIds.length > 0) {
      for (const sId of serviciosIds) {
        await prisma.profesionalServicio.create({
          data: {
            id_profesional: newProf.id_profesional,
            id_servicio: Number(sId),
          },
        }).catch(() => {});
      }
    }

    res.status(201).json(newProf);
  } catch (err: any) {
    console.error('Error creating profesional:', err);
    res.status(500).json({ error: err.message || 'Error al registrar especialista' });
  }
});

router.put('/profesionales/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombres, apellidos, numero_colegiatura, especialidad, activo, serviciosIds } = req.body;

    const updated = await prisma.profesionales.update({
      where: { id_profesional: id },
      data: {
        ...(nombres !== undefined && { nombres: nombres.trim() }),
        ...(apellidos !== undefined && { apellidos: apellidos.trim() }),
        ...(numero_colegiatura !== undefined && { numero_colegiatura: numero_colegiatura.trim() }),
        ...(especialidad !== undefined && { especialidad: especialidad.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    if (Array.isArray(serviciosIds)) {
      await prisma.profesionalServicio.deleteMany({
        where: { id_profesional: id },
      });

      for (const sId of serviciosIds) {
        await prisma.profesionalServicio.create({
          data: {
            id_profesional: id,
            id_servicio: Number(sId),
          },
        }).catch(() => {});
      }
    }

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating profesional:', err);
    res.status(500).json({ error: err.message || 'Error al actualizar especialista' });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. CANALES Y FUENTES
// ─────────────────────────────────────────────────────────────
router.get('/canales-fuentes', async (req, res) => {
  try {
    const [canales, fuentes] = await Promise.all([
      prisma.canales.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
      prisma.fuentes.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] }),
    ]);
    res.json({ canales, fuentes });
  } catch (err: any) {
    console.error('Error fetching canales y fuentes:', err);
    res.status(500).json({ error: 'Error al obtener canales y fuentes' });
  }
});

router.post('/canales', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

    const newCanal = await prisma.canales.create({
      data: { nombre: nombre.trim(), activo: activo !== undefined ? Boolean(activo) : true },
    });
    res.status(201).json(newCanal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/canales/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, activo } = req.body;
    const updated = await prisma.canales.update({
      where: { id_canal: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fuentes', async (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' });

    const newFuente = await prisma.fuentes.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });
    res.status(201).json(newFuente);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/fuentes/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, descripcion, activo } = req.body;
    const updated = await prisma.fuentes.update({
      where: { id_fuente: id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(descripcion !== undefined && { descripcion: descripcion.trim() }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. USUARIOS Y ROLES
// ─────────────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
  try {
    const [usuarios, roles] = await Promise.all([
      prisma.usuarios.findMany({
        select: {
          id_usuario: true,
          nombres: true,
          apellidos: true,
          email: true,
          id_rol: true,
          activo: true,
          Rol: { select: { id_rol: true, nombre: true } },
        },
        orderBy: [{ activo: 'desc' }, { id_usuario: 'asc' }],
      }),
      prisma.roles.findMany({ orderBy: { id_rol: 'asc' } }),
    ]);

    res.json({ usuarios, roles });
  } catch (err: any) {
    console.error('Error fetching usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.post('/usuarios', async (req, res) => {
  try {
    const { nombres, apellidos, email, id_rol, activo } = req.body;
    if (!nombres || !apellidos || !email || !id_rol) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const newUser = await prisma.usuarios.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        email: email.trim().toLowerCase(),
        password_hash: 'hashedpassword_initial',
        id_rol: Number(id_rol),
        activo: activo !== undefined ? Boolean(activo) : true,
      },
      include: { Rol: true },
    });

    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al crear usuario' });
  }
});

router.put('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombres, apellidos, email, id_rol, activo } = req.body;

    const updated = await prisma.usuarios.update({
      where: { id_usuario: id },
      data: {
        ...(nombres !== undefined && { nombres: nombres.trim() }),
        ...(apellidos !== undefined && { apellidos: apellidos.trim() }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(id_rol !== undefined && { id_rol: Number(id_rol) }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
      include: { Rol: true },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar usuario' });
  }
});

export default router;
