import { leadUseCases } from '@/application/use-cases/lead';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const leadService = {
  getLeadDetails: async (id: string) => {
    if (!useApi) {
      const localLead = await leadUseCases.getLeadById(id);
      if (!localLead || !localLead.person) return null;
      return {
        nombres: localLead.person.firstName || '',
        apellidos: localLead.person.lastName || '',
        email: localLead.person.email || '',
        numero: localLead.person.phone || '',
        Interacciones: [{ Canal: { nombre: localLead.buyer?.channel || 'Web' } }],
        Solicitudes: [{
          id_solicitud: 1,
          Servicio: { nombre: localLead.requestedServiceId || 'Evaluación' },
          motivo: localLead.buyer?.concreteRequest || '',
          Opciones: (localLead.alternatives || []).map((alt: any) => ({
            id_opcion: alt.id,
            precio_ofrecido: alt.price,
            seleccionada: alt.id === localLead.selectedAlternativeId,
            Disponibilidad: {
              fecha: alt.date + "T00:00:00.000Z",
              hora_inicio: "1970-01-01T" + alt.time + ":00.000Z",
              hora_fin: "1970-01-01T" + alt.time + ":00.000Z",
              Sede: { nombre: alt.branch },
              Profesional: { apellidos: alt.professional }
            }
          }))
        }],
        Preferencias: [{ sede_preferida: localLead.declaredPreferences || 'Sede Central' }]
      };
    }
    const res = await fetch(`${API_URL}/lead/${id}`);
    if (!res.ok) throw new Error('Error al cargar datos del LEAD');
    return res.json();
  },

  getAvailabilityOptions: async () => {
    if (!useApi) return { disponibilidades: [] }; // Fallback for local
    const res = await fetch(`${API_URL}/lead/options/availability`);
    if (!res.ok) throw new Error('Error al cargar opciones de disponibilidad');
    return res.json();
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
  }
};
