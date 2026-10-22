/**
 * Lightweight error monitoring (Phase 4).
 *
 * Captures uncaught errors and unhandled promise rejections in the browser and
 * forwards them to an optional webhook (set VITE_ERROR_WEBHOOK_URL). When no
 * webhook is configured, errors are kept in a bounded in-memory buffer that the
 * UI/tests can inspect — nothing is ever silently dropped and no user content
 * is included beyond the error message/stack and the current route path.
 *
 * Privacy: only message, stack, route, and timestamp are sent. Journal/prayer
 * payloads are never attached here.
 */

const MAX_BUFFERED = 50

interface CapturedError {
  message: string
  stack?: string
  route: string
  at: string
}

const buffer: CapturedError[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

function currentRoute(): string {
  try {
    return typeof window !== 'undefined' ? window.location.pathname : 'n/a'
  } catch {
    return 'n/a'
  }
}

export function getCapturedErrors(): readonly CapturedError[] {
  return buffer
}

export function clearCapturedErrors(): void {
  buffer.length = 0
}

/** Records an error locally and schedules a webhook flush. */
export function reportError(err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err))
  buffer.push({
    message: e.message,
    stack: e.stack,
    route: currentRoute(),
    at: new Date().toISOString(),
  })
  if (buffer.length > MAX_BUFFERED) buffer.splice(0, buffer.length - MAX_BUFFERED)
  scheduleFlush()
}

function scheduleFlush(): void {
  const url = import.meta.env?.VITE_ERROR_WEBHOOK_URL as string | undefined
  if (!url) return
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush(url)
  }, 2000)
}

async function flush(url: string): Promise<void> {
  const payload = { app: 'believers-elibrary', errors: buffer.slice() }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
    buffer.length = 0
  } catch {
    /* webhook unreachable — keep the buffer; retried on next error */
  }
}

/** Installs global handlers. Safe to call multiple times. */
export function installErrorMonitoring(): void {
  if (installed) return
  installed = true
  window.addEventListener('error', (ev) => {
    reportError(ev.error ?? ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    reportError(ev.reason)
  })
}
