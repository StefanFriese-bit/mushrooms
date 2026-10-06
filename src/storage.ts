export type KeptAnswer = 'yes' | 'not yet' | 'not supported in this browser';

/**
 * Asks the phone to keep this app's data (spec §8: "the app asks the iPhone to keep its data") and says whether it
 * does. Safari asks nobody; it answers by its own rules. Never throws.
 */
export async function keepData(): Promise<KeptAnswer> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage?.persisted) return 'not supported in this browser';
  try {
    if (await storage.persisted()) return 'yes';
    if (storage.persist && (await storage.persist())) return 'yes';
    return 'not yet';
  } catch {
    return 'not yet';
  }
}
