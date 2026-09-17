import type { IRepository } from '@/application/ports';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Adaptador de repositorio HTTP para conectar el Frontend a la API REST de Express + SQL Server / Prisma.
 */
export class ApiRepository<T extends { id: string }> implements IRepository<T> {
  private endpoint: string;

  constructor(collectionKey: string) {
    this.endpoint = `${API_BASE_URL}/${collectionKey.toLowerCase()}`;
  }

  async getAll(): Promise<T[]> {
    try {
      const response = await fetch(this.endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Error al listar ${this.endpoint}`);
      return await response.json();
    } catch (error) {
      console.warn(`[ApiRepository] Error al obtener ${this.endpoint}, fallback local active`, error);
      return [];
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.endpoint}/${id}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`[ApiRepository] Error al obtener elemento por id ${id}`, error);
      return null;
    }
  }

  async create(item: T): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error(`Error HTTP al crear en ${this.endpoint}`);
    return await response.json();
  }

  async update(id: string, partialItem: Partial<T>): Promise<T> {
    const response = await fetch(`${this.endpoint}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialItem),
    });
    if (!response.ok) throw new Error(`Error HTTP al actualizar id ${id}`);
    return await response.json();
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Error HTTP al eliminar id ${id}`);
  }
}

