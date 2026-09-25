import { leadUseCases } from '@/application/use-cases/lead';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const leadService = {
  getLeadDetails: async (id: string) => {
    const cleanId = id ? (id.replace(/\D/g, '') || id) : id;
    let data: any = null;

    try {
      const res = await fetch(`${API_URL}/lead/${cleanId}`);
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn('Backend fetch for lead failed, attempting fallback:', err);
    }

    if (!data && !useApi) {
      data = await leadUseCases.getLeadById(id);
    }

    if (!data) return null;

    // Direct backend Prisma object structure (has nombres/apellidos)
    if (data.nombres || data.apellidos) {
      return data;
    }

    // Mock/Domain object structure (has person property)
    if (data.person) {
      return {
        id_persona: Number(data.id || id),
        nombres: data.person.firstName || '',
        apellidos: data.person.lastName || '',
        email: data.person.email || '',
        numero: data.person.phone || '',
        dni: data.person.documentNumber || '',
        Interacciones: [{ Canal: { nombre: data.buyer?.channel || 'Web' } }],
        Solicitudes: [{
          id_solicitud: 1,
          Servicio: { nombre: data.requestedServiceId || 'Evaluación' },
          motivo: data.buyer?.concreteRequest || '',
          Opciones: (data.alternatives || []).map((alt: any) => ({
            id_opcion: alt.id,
            precio_ofrecido: alt.price,
            seleccionada: alt.id === data.selectedAlternativeId,
            Disponibilidad: {
              fecha: alt.date + "T00:00:00.000Z",
              hora_inicio: "1970-01-01T" + alt.time + ":00.000Z",
              hora_fin: "1970-01-01T" + alt.time + ":00.000Z",
              Sede: { nombre: alt.branch },
              Profesional: { apellidos: alt.professional }
            }
          }))
        }],
        Preferencias: [{ sede_preferida: data.declaredPreferences || data.buyer?.preferences || 'Sede Central' }]
      };
    }

    return data;
  },

  getAvailabilityOptions: async () => {
    try {
      const res = await fetch(`${API_URL}/lead/options/availability`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Backend fetch for availability options failed:', err);
    }
    return { profesionales: [], sedes: [], servicios: [], disponibilidades: [] };
  },

  reserve: async (id: string, data: any) => {
    if (!useApi) {
      if (!data.id_opcion) throw new Error('Opcion no seleccionada');
      return leadUseCases.selectAlternativeAndReserve(id, data.id_opcion);
    }
    const res = await fetch(`${API_URL}/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al registrar reserva');
    return res.json();
  },

  getAllLeads: async () => {
    if (!useApi) return leadUseCases.getAllLeads();
    const res = await fetch(`${API_URL}/lead`);
    if (!res.ok) throw new Error('Error al cargar leads');
    return res.json();
  },

  updateLead: async (id: string, data: any) => {
    if (!useApi) return leadUseCases.updateLead(id, data);
    const res = await fetch(`${API_URL}/lead/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar lead');
    return res.json();
  },

  addAlternative: async (id: string, data: any) => {
    if (!useApi) return leadUseCases.addAlternative(id, data);
    const res = await fetch(`${API_URL}/lead/${id}/alternative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al añadir alternativa');
    return res.json();
  },

  updateAlternative: async (id_opcion: number | string, data: any) => {
    if (!useApi) return leadUseCases.updateAlternative(id_opcion as string, data);
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar alternativa');
    return res.json();
  },

  deleteAlternative: async (id_opcion: number | string) => {
    if (!useApi) return leadUseCases.deleteAlternative(id_opcion as string);
    const res = await fetch(`${API_URL}/lead/options/${id_opcion}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar alternativa');
    return res.json();
  },

  convertToPayer: async (id: string, data: any = {}) => {
    if (!useApi) return leadUseCases.convertToPayer(id);
    const res = await fetch(`${API_URL}/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al convertir lead a payer');
    return res.json();
  },

  abandonLead: async (id: string, motivo?: string) => {
    if (!useApi) return null;
    const res = await fetch(`${API_URL}/lead/${id}/abandon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo })
    });
    if (!res.ok) throw new Error('Error al registrar abandono del lead');
    return res.json();
  },

  generateCanvaFlyer: async (id: string | number, payload: any) => {
    const cleanId = String(id).replace(/\D/g, '') || id;
    const candidates = [
      `${API_URL}/leads/${cleanId}/canva-flyer`,
      `${API_URL}/lead/${cleanId}/canva-flyer`,
      `/api/leads/${cleanId}/canva-flyer`,
      `/api/lead/${cleanId}/canva-flyer`,
    ];

    let lastError: any = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return await res.json();
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(lastError?.message || 'Error al comunicarse con el servicio de Canva Connect');
  }
};
