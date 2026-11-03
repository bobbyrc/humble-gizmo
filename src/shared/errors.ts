import type { Service } from './types';
export class ServiceChangedError extends Error {
  constructor(public service: Service, public detail: string) { super(`${service} changed: ${detail}`); }
}
export class SessionExpiredError extends Error {
  constructor(public service: Service) { super(`${service} session expired`); }
}
