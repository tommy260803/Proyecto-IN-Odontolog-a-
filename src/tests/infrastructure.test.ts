import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalRepository } from '../infrastructure/repositories';
import { initializeMockData } from '../infrastructure/seed';
import { storage } from '../infrastructure/storage';
import { DOMAIN_CONSTANTS, QUERY_KEYS } from '../shared/constants';

interface TestEntity {
  id: string;
  name: string;
}

describe('Infrastructure & Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('LocalRepository performs CRUD correctly', async () => {
    const repo = new LocalRepository<TestEntity>('test_collection');

    // Create
    await repo.create({ id: '1', name: 'Item 1' });
    let items = await repo.getAll();
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Item 1');

    // GetById
    const item = await repo.getById('1');
    expect(item?.name).toBe('Item 1');

    // Update
    await repo.update('1', { name: 'Item 1 Updated' });
    const updated = await repo.getById('1');
    expect(updated?.name).toBe('Item 1 Updated');

    // Delete
    await repo.delete('1');
    items = await repo.getAll();
    expect(items.length).toBe(0);
  });

  it('Seed initializes idempotently', async () => {
    // First run
    await initializeMockData();
    const isSeeded1 = await storage.getItem<boolean>(
      DOMAIN_CONSTANTS.SEED_FLAG_KEY,
    );
    expect(isSeeded1).toBe(true);

    const personsRepo = new LocalRepository(QUERY_KEYS.PERSONS);
    const initialPersonsCount = (await personsRepo.getAll()).length;
    expect(initialPersonsCount).toBeGreaterThan(0);

    // Second run
    await initializeMockData();
    const currentPersonsCount = (await personsRepo.getAll()).length;
    // Should not duplicate data
    expect(currentPersonsCount).toBe(initialPersonsCount);
  });
});
