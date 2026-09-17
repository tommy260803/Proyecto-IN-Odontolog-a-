export const leadService = {
  getLeadDetails: async (id: string) => {
    const res = await fetch(`http://localhost:3001/api/lead/${id}`);
    if (!res.ok) throw new Error('Error al cargar datos del LEAD');
    return res.json();
  },

  getAvailabilityOptions: async () => {
    const res = await fetch('http://localhost:3001/api/lead/options/availability');
    if (!res.ok) throw new Error('Error al cargar opciones de disponibilidad');
    return res.json();
  },

  reserve: async (id: string, data: any) => {
    const res = await fetch(`http://localhost:3001/api/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al registrar reserva');
    return res.json();
  },

  getAllLeads: async () => {
    const res = await fetch('http://localhost:3001/api/lead');
    if (!res.ok) throw new Error('Error al cargar leads');
    return res.json();
  },

  updateLead: async (id: string, data: any) => {
    const res = await fetch(`http://localhost:3001/api/lead/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar lead');
    return res.json();
  },

  addAlternative: async (id: string, data: any) => {
    const res = await fetch(`http://localhost:3001/api/lead/${id}/alternative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al añadir alternativa');
    return res.json();
  },

  convertToPayer: async (id: string, data: any = {}) => {
    // Para simplificar, mapeamos convertToPayer a la ruta /reserve con datos dummy
    // o podemos requerir que data tenga id_solicitud y id_disponibilidad
    const res = await fetch(`http://localhost:3001/api/lead/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al convertir lead a payer');
    return res.json();
  }
};
