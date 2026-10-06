import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepData } from './storage';

const withStorage = (storage: unknown) => vi.stubGlobal('navigator', { storage });
afterEach(() => vi.unstubAllGlobals());

describe('keepData', () => {
  it('says yes without asking again when the phone already keeps the data', async () => {
    const persist = vi.fn();
    withStorage({ persisted: async () => true, persist });
    expect(await keepData()).toBe('yes');
    expect(persist).not.toHaveBeenCalled();
  });
  it('asks the phone to keep the data, and reports its answer', async () => {
    withStorage({ persisted: async () => false, persist: async () => true });
    expect(await keepData()).toBe('yes');
    withStorage({ persisted: async () => false, persist: async () => false });
    expect(await keepData()).toBe('not yet');
  });
  it('never throws, and says when the browser cannot be asked', async () => {
    withStorage({ persisted: async () => false, persist: async () => { throw new Error('refused'); } });
    expect(await keepData()).toBe('not yet');
    withStorage(undefined);
    expect(await keepData()).toBe('not supported in this browser');
  });
});
