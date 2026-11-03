import type { HttpClient } from './httpClient'
import { SessionHttpClient } from './sessionHttpClient'
import { WindowHttpClient } from './windowHttpClient'

// Which transport talks to Humble. 'session' uses ses.fetch; 'window' fetches from a hidden page.
export const HUMBLE_TRANSPORT: 'session' | 'window' = 'session'

const HUMBLE_PARTITION = 'persist:humble'
const HUMBLE_ORIGIN = 'https://www.humblebundle.com/home/library'

export function createHumbleHttpClient(): HttpClient {
  return HUMBLE_TRANSPORT === 'window'
    ? new WindowHttpClient(HUMBLE_PARTITION, HUMBLE_ORIGIN)
    : new SessionHttpClient(HUMBLE_PARTITION)
}
