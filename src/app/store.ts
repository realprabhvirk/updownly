/**
 * App-wide state: the persisted save plus transient UI state. Components
 * read signals; all writes to the save go through `updateSave`.
 */
import { computed, signal } from '@preact/signals';
import { browserStorage, clearSave, defaultSave, loadSave, writeSave, type SaveData } from '../services/storage';

const storage = browserStorage();

/** False when localStorage is unavailable — data lasts for this session only. */
export const storageAvailable = storage !== null;

export const save = signal<SaveData>(loadSave(storage));
export const settings = computed(() => save.value.settings);

export function updateSave(fn: (s: SaveData) => SaveData): void {
  save.value = fn(save.value);
  writeSave(storage, save.value);
}

export function updateSettings(patch: Partial<SaveData['settings']>): void {
  updateSave((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetAll(): void {
  clearSave(storage);
  save.value = defaultSave();
}

export function clearHistory(): void {
  updateSave((s) => ({ ...s, recent: [] }));
}

// ── Transient UI state ─────────────────────────────────────────────────
export type Toast = { id: number; text: string };
export const toast = signal<Toast | null>(null);
let toastId = 0;
export function showToast(text: string): void {
  const id = ++toastId;
  toast.value = { id, text };
  setTimeout(() => {
    if (toast.value?.id === id) toast.value = null;
  }, 2600);
}

/** Set by the service worker registration when a new version is waiting. */
export const updateReady = signal<null | (() => void)>(null);

/** Category sheet currently open (collection id), if any. */
export const openCategory = signal<string | null>(null);
/** Fact detail sheet. */
export const openFactId = signal<string | null>(null);
/** Install help sheet. */
export const installSheetOpen = signal(false);

/** Effective presentation preferences (resolved against the system). */
export const systemDark = signal(false);
export const systemReducedMotion = signal(false);
export const effectiveTheme = computed(() =>
  settings.value.theme === 'system' ? (systemDark.value ? 'dark' : 'light') : settings.value.theme,
);
export const reducedMotion = computed(() =>
  settings.value.motion === 'system' ? systemReducedMotion.value : settings.value.motion === 'reduce',
);
