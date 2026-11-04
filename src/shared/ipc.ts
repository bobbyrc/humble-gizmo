// src/shared/ipc.ts — the preload bridge contract, implemented in Task 17
import type {
  ChoiceMonth, KeyRecord, ReviewItem, RunEvent, Service, Settings,
} from './types';
export type ChoiceListing = { months: ChoiceMonth[]; locked: number }; // locked: picks Humble would not open
export type LibrarySummary = { keys: number; steamKeys: number; failedOrders: number };
export type GizmoApi = {
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  signIn(service: Service): Promise<boolean>;      // opens sign-in window; resolves on success/close
  signOut(service: Service): Promise<void>;
  status(): Promise<Record<Service, boolean>>;     // signed in?
  loadLibrary(): Promise<LibrarySummary>;
  buildReview(): Promise<ReviewItem[]>;
  startRun(keyIds: string[]): Promise<void>;
  stopRun(): Promise<void>;
  onRunEvent(cb: (e: RunEvent) => void): () => void; // returns unsubscribe
  listChoiceMonths(): Promise<ChoiceListing>;
  claimChoices(monthGamekey: string, identifiers: string[]): Promise<{ failed: string[] }>;
  openExternal(url: string): Promise<void>;        // only humblebundle.com / steampowered.com / github.com release URLs
  history(): Promise<KeyRecord[]>;
  exportCsv(opts: ExportOptions & { revealAll: boolean; withOwnership: boolean }): Promise<{ saved: boolean; path?: string }>;
  deleteAllData(): Promise<void>;
  checkForUpdatesNow(): Promise<'none' | 'available' | 'error'>;
  storageEncrypted(): Promise<boolean>;
};
export type ExportOptions = { steamOnly: boolean; includeRevealed: boolean; includeUnrevealed: boolean };
