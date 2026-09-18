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
          { id_canal: 1, nombre: 'WhatsApp' },
          { id_canal: 2, nombre: 'Facebook' },
          { id_canal: 3, nombre: 'Página Web' },
          { id_canal: 4, nombre: 'Recomendación' }
        ],
        fuentes: [
          { id_fuente: 1, nombre: 'Campaña Redes Enero' },
          { id_fuente: 2, nombre: 'Búsqueda Orgánica' },
          { id_fuente: 3, nombre: 'Referido' }
        ],
        sedes: [
          { id_sede: 1, nombre: 'Sede Norte' },
          { id_sede: 2, nombre: 'Sede Sur' },
          { id_sede: 3, nombre: 'Sede Centro' }
        ]
      };
    }
    const res = await fetch(`${API_URL}/buyer/catalogs`);
    if (!res.ok) throw new Error('Error al cargar catálogos');
    return res.json();
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
