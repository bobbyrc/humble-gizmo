import type { Session } from 'electron'

/** Denies every permission request and turns off spellcheck (which can send typed text out). */
export function hardenSession(
  ses: Pick<
    Session,
    'setSpellCheckerEnabled' | 'setPermissionRequestHandler' | 'setPermissionCheckHandler'
  >
): void {
  ses.setSpellCheckerEnabled(false)
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}
