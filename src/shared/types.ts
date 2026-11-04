export type HumbleKey = {
  id: string;               // `${gamekey}:${keyindex}:${machineName}`
  gamekey: string;
  keyindex: number;
  machineName: string;      // tpk.machine_name
  name: string;             // tpk.human_name, trimmed
  keyTypeName: string;      // tpk.key_type_human_name
  isSteam: boolean;         // tpk has a `steam_app_id` property (even if null)
  steamAppId: number | null;// null when missing or 0
  revealedKey: string | null; // tpk.redeemed_key_val
  isGift: boolean;
  isExpired: boolean;
  bundle?: string;          // the order's product.human_name, trimmed
  purchased?: string;       // the order's created timestamp, as Humble sends it
};
export type Ownership = 'owned' | 'maybe' | 'not_owned';
export type OwnedData = { ids: Set<number>; names: Map<number, string> };
export type Outcome = 'pending' | 'redeemed' | 'owned' | 'error';
export type KeyRecord = {
  id: string; name: string; steamAppId: number | null;
  revealedKey: string | null; outcome: Outcome; resultCode: number | null;
  runId: string; updatedAt: string; // ISO 8601
};
export type ReviewGroup = 'will_redeem' | 'maybe_owned' | 'owned' | 'failed_before' | 'done_before';
export type ReviewReason = 'duplicate' | 'unrevealed' | 'terminal_error' | 'retryable_error';
export type ReviewItem = {
  key: HumbleKey; group: ReviewGroup; ticked: boolean; tickable: boolean;
  reasons: ReviewReason[]; matchedName?: string;
};
export type ChoiceGame = {
  identifier: string;        // display_item_machine_name
  title: string;
  rating: { text: string; percent: number | null } | null;
  claimable: boolean;        // has tpkds
  gamekey: string | null;    // tpkds[0].gamekey
};
export type ChoiceMonth = {
  gamekey: string; name: string; choiceUrl: string; created: string;
  usesChoices: boolean; choicesRemaining: number; parentIdentifier: string;
  games: ChoiceGame[];
};
export type RunEvent =
  | { type: 'key-start'; id: string }
  | { type: 'revealing'; id: string }
  | { type: 'key-done'; id: string; outcome: Exclude<Outcome, 'pending'>; code: number | null }
  | { type: 'rate-limited'; id: string; resumeAt: string; attempt: number }
  | { type: 'stopped'; reason: 'user' | 'steam-signed-out' | 'humble-signed-out' | 'error' }
  | { type: 'finished'; summary: RunSummary };
export type RunSummary = { redeemed: number; owned: number; errors: number; remaining: number };
export type Settings = {
  consentShown: boolean; autoUpdate: boolean;
  scheduleHours: number | null; keepInBackground: boolean; launchAtLogin: boolean;
};
export const DEFAULT_SETTINGS: Settings = {
  consentShown: false, autoUpdate: false, scheduleHours: null,
  keepInBackground: false, launchAtLogin: false,
};
export type Service = 'humble' | 'steam';
