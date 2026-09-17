export const buyerService = {
  getCatalogs: async () => {
    const res = await fetch('http://localhost:3001/api/buyer/catalogs');
    if (!res.ok) throw new Error('Error al cargar catálogos');
    return res.json();
  },

  registerAndConvert: async (data: any) => {
    const res = await fetch('http://localhost:3001/api/buyer/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al registrar la solicitud');
    return res.json();
  },

  getAllBuyers: async () => {
    const res = await fetch('http://localhost:3001/api/buyer');
    if (!res.ok) throw new Error('Error al cargar buyers');
    return res.json();
  },

  createBuyer: async (data: any) => {
    const res = await fetch('http://localhost:3001/api/buyer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear buyer');
    return res.json();
  },

  updateBuyer: async (id: string, data: any) => {
    const res = await fetch(`http://localhost:3001/api/buyer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar buyer');
    return res.json();
  },

  convertToLead: async (id: string) => {
    const res = await fetch(`http://localhost:3001/api/buyer/${id}/convert`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Error al convertir buyer a lead');
    return res.json();
  }
};
