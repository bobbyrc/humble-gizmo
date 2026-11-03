// Whether update checks may reach github.com. Task 25 drives this; the session guard reads it.
let updatesAllowed = false

export function setUpdatesAllowed(allowed: boolean): void {
  updatesAllowed = allowed
}

export function getUpdatesAllowed(): boolean {
  return updatesAllowed
}
