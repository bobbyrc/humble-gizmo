import type { BrowserWindow } from 'electron'
import { isAllowedUrl } from './allowlist'
import { encodeForm, requireAllowed, type HttpClient } from './httpClient'

type Res = { status: number; body: string }

/**
 * Runs requests as `fetch` calls inside a hidden page on the origin site, so they carry exactly
 * the cookies and headers a real browser tab would.
 */
export class WindowHttpClient implements HttpClient {
  private win: Promise<BrowserWindow> | null = null

  constructor(
    private readonly partition: string,
    private readonly origin: string
  ) {}

  private window(): Promise<BrowserWindow> {
    this.win ??= this.create().catch((e: unknown) => {
      this.win = null
      throw e
    })
    return this.win
  }

  private async create(): Promise<BrowserWindow> {
    requireAllowed(this.origin)
    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        partition: this.partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    win.on('closed', () => {
      this.win = null
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event, url) => {
      if (!isAllowedUrl(url, { updatesAllowed: false })) event.preventDefault()
    })
    try {
      await win.loadURL(this.origin)
    } catch (e) {
      if (!win.isDestroyed()) win.destroy()
      throw e
    }
    return win
  }

  private async send(
    url: string,
    method: 'GET' | 'POST',
    headers?: Record<string, string>,
    body?: string
  ): Promise<Res> {
    requireAllowed(url)
    const win = await this.window()
    const init = { credentials: 'include', redirect: 'manual', method, headers, body }
    const script = `(async () => {
      const r = await fetch(${JSON.stringify(url)}, ${JSON.stringify(init)})
      return { status: r.type === 'opaqueredirect' ? 302 : r.status, body: await r.text() }
    })()`
    return (await win.webContents.executeJavaScript(script)) as Res
  }

  get(url: string): Promise<Res> {
    return this.send(url, 'GET')
  }

  postForm(url: string, form: [string, string][], headers?: Record<string, string>): Promise<Res> {
    return this.send(url, 'POST', headers, encodeForm(form))
  }

  async getCookie(url: string, name: string): Promise<string | undefined> {
    requireAllowed(url)
    const win = await this.window()
    const cookies = await win.webContents.session.cookies.get({ url, name })
    return cookies[0]?.value
  }

  dispose(): void {
    const pending = this.win
    this.win = null
    void pending?.then((w) => {
      if (!w.isDestroyed()) w.destroy()
    })
  }
}
