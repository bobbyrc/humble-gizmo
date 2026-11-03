// src/shared/copy.ts — verbatim from the spec; the UI imports from here only
export const PRIVACY_TITLE = 'Your data stays on this computer.';
export const PRIVACY_LINE_1 = 'This app only talks to Humble Bundle and Steam.';
export const PRIVACY_LINE_2 = 'Nothing is sent to the developer unless you turn it on below.';
export const UPDATE_TOGGLE = 'Check for updates automatically';
export const UPDATE_TOGGLE_NOTE = '(contacts GitHub)';
export const CHECK_UPDATES_NOW = 'Check for updates now';
export const UNREVEALED_LABEL = 'uses up its gift link';
export const NOT_AFFILIATED = 'Not affiliated with Humble Bundle or Valve.';
export const serviceChanged = (s: 'Humble' | 'Steam') => `${s} changed something — check for an update.`;
export const rateLimitMessage = (time: string) =>
  `Steam allows about 50 activations an hour. Continuing at ${time}. You can leave this running.`;
export const newKeysNotification = (n: number) => `${n} new games ready to redeem`;
export const NO_KEYRING_NOTICE =
  'Your system has no password keychain, so revealed keys are saved unencrypted on this computer.';
export const GROUP_LABELS = {
  will_redeem: 'Will redeem', maybe_owned: 'Might already own', owned: 'You already own',
  failed_before: 'Failed before', done_before: 'Already done in an earlier run',
} as const;
