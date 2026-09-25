import { buyerUseCases } from '@/application/use-cases/buyer';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const buyerService = {
  getCatalogs: async () => {
    if (!useApi) {
      return {
        servicios: [
          { id_servicio: 1, nombre: 'Evaluación General' },
          { id_servicio: 2, nombre: 'Ortodoncia Inicial' },
          { id_servicio: 3, nombre: 'Blanqueamiento Dental' },
          { id_servicio: 4, nombre: 'Implante Dental' }
        ],
        canales: [
          { id_canal: 1, nombre: 'Presencial (Recepción en Sede)' },
          { id_canal: 2, nombre: 'Llamada Telefónica' },
          { id_canal: 3, nombre: 'WhatsApp Directo' },
          { id_canal: 4, nombre: 'Página Web / Portal Online' },
          { id_canal: 5, nombre: 'Redes Sociales (Instagram / FB / TikTok)' },
          { id_canal: 6, nombre: 'Recomendación / Referido' }
        ],
        fuentes: [
          { id_fuente: 1, nombre: 'Visita Espontánea / Walk-in' },
          { id_fuente: 2, nombre: 'Meta Ads (Instagram / FB)' },
          { id_fuente: 3, nombre: 'Google Ads / Búsqueda' },
          { id_fuente: 4, nombre: 'Búsqueda Orgánica Web' },
          { id_fuente: 5, nombre: 'Recomendación de Paciente' }
        ],
        sedes: [
          { id_sede: 1, nombre: 'Sede Norte' },
          { id_sede: 2, nombre: 'Sede Sur' },
          { id_sede: 3, nombre: 'Sede Centro' }
        ],
        modalidades: [
          { id_modalidad: 1, nombre: 'Presencial' },
          { id_modalidad: 2, nombre: 'Virtual' },
          { id_modalidad: 3, nombre: 'Teleconsulta' },
          { id_modalidad: 4, nombre: 'Domiciliaria' }
        ],
        horarios: []
      };
    }
    const res = await fetch(`${API_URL}/buyer/catalogs`);
    if (!res.ok) throw new Error('Error al cargar catálogos');
    return res.json();
  },

  checkDuplicate: async (params: { phone?: string; email?: string; dni?: string; excludeId?: string }) => {
    const query = new URLSearchParams();
    if (params.phone) query.append('phone', params.phone);
    if (params.email) query.append('email', params.email);
    if (params.dni) query.append('dni', params.dni);
    if (params.excludeId) query.append('excludeId', params.excludeId);

    try {
      const res = await fetch(`${API_URL}/buyer/check-duplicate?${query.toString()}`);
      if (!res.ok) return { isDuplicate: false };
      return res.json();
    } catch (e) {
      console.warn('Error checking duplicate:', e);
      return { isDuplicate: false };
    }
  },

  registerAndConvert: async (data: any) => {
    if (!useApi) {
      const buyer = await buyerUseCases.createBuyer(data);
      return buyerUseCases.convertToLead(buyer.id);
    }
    const res = await fetch(`${API_URL}/buyer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al registrar la solicitud');
    return res.json();
  },

  getAllBuyers: async () => {
    if (!useApi) return buyerUseCases.getAllBuyers();
    const res = await fetch(`${API_URL}/buyer`);
    if (!res.ok) throw new Error('Error al cargar buyers');
    return res.json();
  },

  createBuyer: async (data: any) => {
    if (!useApi) return buyerUseCases.createBuyer(data);
    const res = await fetch(`${API_URL}/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al crear buyer');
    }
    return res.json();
  },

  updateBuyer: async (id: string, data: any) => {
    if (!useApi) return buyerUseCases.updateBuyer(id, data);
    const res = await fetch(`${API_URL}/buyer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar buyer');
    }
    return res.json();
  },

  convertToLead: async (id: string) => {
    if (!useApi) return buyerUseCases.convertToLead(id);
    const res = await fetch(`${API_URL}/buyer/${id}/convert`, {
      method: 'POST'
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al convertir buyer a lead');
    }
    return res.json();
  }
};
