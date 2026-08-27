import { get, set } from 'idb-keyval';
import type { Visit } from '../types';

// Everything lives in this browser's IndexedDB only — nothing is ever sent
// to a server. That keeps the photos private, but it also means the data
// doesn't sync between devices or survive clearing site data.
const STORAGE_KEY = 'travel-map-visits';

export async function loadVisits(): Promise<Visit[]> {
  const stored = await get<Visit[]>(STORAGE_KEY);
  return stored ?? [];
}

export async function saveVisits(visits: Visit[]): Promise<void> {
  await set(STORAGE_KEY, visits);
}
