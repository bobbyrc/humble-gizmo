import { describe, expect, it } from 'vitest'
import { APP_WINDOW_WEB_PREFERENCES } from '../../src/main/windows/appWindow'

describe('APP_WINDOW_WEB_PREFERENCES', () => {
  it('locks the renderer down', () => {
    expect(APP_WINDOW_WEB_PREFERENCES.contextIsolation).toBe(true)
    expect(APP_WINDOW_WEB_PREFERENCES.nodeIntegration).toBe(false)
    expect(APP_WINDOW_WEB_PREFERENCES.sandbox).toBe(true)
    expect(APP_WINDOW_WEB_PREFERENCES.preload).toBeDefined()
  })
})
