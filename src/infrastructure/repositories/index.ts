import type { IRepository } from '@/application/ports';
import { storage } from '../storage';

/**
 * Implementación base de repositorio simulado usando localStorage asíncrono.
 */
export class LocalRepository<
  T extends { id: string },
> implements IRepository<T> {
  private collectionKey: string;

  constructor(collectionKey: string) {
    this.collectionKey = collectionKey;
  }

  async getAll(): Promise<T[]> {
    const data = await storage.getItem<T[]>(this.collectionKey);
    return data || [];
  }

  async getById(id: string): Promise<T | null> {
    const data = await this.getAll();
    const item = data.find((d) => d.id === id);
    return item || null;
  }

  async create(item: T): Promise<T> {
    const data = await this.getAll();
    data.push(item);
    await storage.setItem(this.collectionKey, data);
    return item;
  }

  async update(id: string, partialItem: Partial<T>): Promise<T> {
    const data = await this.getAll();
    const index = data.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new Error(
        `Elemento con id ${id} no encontrado en ${this.collectionKey}`,
      );
    }

    const updatedItem = { ...data[index], ...partialItem } as T;
    data[index] = updatedItem;
    await storage.setItem(this.collectionKey, data);
    return updatedItem;
  }

  async delete(id: string): Promise<void> {
    const data = await this.getAll();
    const filteredData = data.filter((d) => d.id !== id);
    await storage.setItem(this.collectionKey, filteredData);
  }
}
