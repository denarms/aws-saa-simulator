/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Small, defensive localStorage wrapper. All reads/writes are wrapped in
// try/catch so a disabled storage API, a full quota, or corrupted JSON
// never crashes the app — the simulator just falls back to in-memory state.

const NAMESPACE = "saa_sim";

function namespacedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(namespacedKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[storage] No se pudo leer "${key}", usando valor por defecto.`, err);
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(namespacedKey(key), JSON.stringify(value));
    return true;
  } catch (err) {
    // Most commonly a QuotaExceededError when the question bank + AI
    // explanations grow very large. We swallow it so typing/answering
    // never throws — the user just loses persistence for that write.
    console.warn(`[storage] No se pudo guardar "${key}" (¿cuota excedida?).`, err);
    return false;
  }
}

export function removeJSON(key: string): void {
  try {
    window.localStorage.removeItem(namespacedKey(key));
  } catch (err) {
    console.warn(`[storage] No se pudo eliminar "${key}".`, err);
  }
}

export const STORAGE_KEYS = {
  questionBank: "questionBank",
  examHistory: "examHistory",
  settings: "settings",
  session: "session",
} as const;

// The session snapshot is read from several independent useState
// initializers on first mount. We cache the parsed value once so we only
// touch localStorage/JSON.parse a single time per page load, regardless of
// how many pieces of state read from it.
let cachedSession: unknown | undefined;

export function loadSessionSnapshot<T>(): Partial<T> | null {
  if (cachedSession === undefined) {
    cachedSession = loadJSON<Partial<T> | null>(STORAGE_KEYS.session, null);
  }
  return cachedSession as Partial<T> | null;
}
