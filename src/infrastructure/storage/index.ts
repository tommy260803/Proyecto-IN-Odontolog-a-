/**
 * Utilidad encapsulada para acceder a localStorage de forma asíncrona.
 * Ningún componente de React debe usar localStorage directamente.
 */
export const storage = {
  async getItem<T>(key: string): Promise<T | null> {
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value));
  },

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
};
