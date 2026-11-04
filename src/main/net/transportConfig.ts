import type { HttpClient } from './httpClient'
import { SessionHttpClient } from './sessionHttpClient'

const HUMBLE_PARTITION = 'persist:humble'

export function createHumbleHttpClient(): HttpClient {
  return new SessionHttpClient(HUMBLE_PARTITION)
}
