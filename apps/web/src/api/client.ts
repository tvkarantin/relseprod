/**
 * Single HTTP client for the FastAPI backend.
 *
 * The frontend never talks to Apify and never holds an API token: every
 * external call goes through our own backend.
 */

import { ERROR_CODES, type ApiErrorBody } from '@/types/api'

const DEFAULT_TIMEOUT_MS = 20_000

const configuredApiUrl =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:8000/api/v1'

export const API_URL: string =
  typeof window !== 'undefined' &&
  window.location.hostname === '127.0.0.1' &&
  configuredApiUrl.includes('://localhost:')
    ? configuredApiUrl.replace('://localhost:', '://127.0.0.1:')
    : configuredApiUrl

/** Typed error carrying the backend's unified error envelope. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Record<string, unknown>

  constructor(
    message: string,
    options: { code: string; status: number; details?: Record<string, unknown> },
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status
    this.details = options.details ?? {}
  }

  /** True when the request failed before reaching the server. */
  get isNetworkError(): boolean {
    return this.code === ERROR_CODES.network
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const { error } = value as { error: unknown }
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

export type QueryValue = string | number | boolean | null | undefined

/** Build a query string, skipping empty values so URLs stay clean. */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text === '') continue
    search.set(key, text)
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

/**
 * Perform a JSON request and unwrap the response.
 *
 * Errors are always surfaced as {@link ApiError} so callers never have to deal
 * with raw `fetch` rejections or unparsed bodies.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Timeout', 'TimeoutError'))
  }, timeoutMs)

  // Forward an externally requested abort to our controller.
  const onExternalAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
  } catch (cause) {
    // A caller-initiated abort must stay an abort so React Query ignores it.
    if (signal?.aborted) throw cause
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new ApiError('Превышено время ожидания ответа сервера', {
        code: ERROR_CODES.network,
        status: 0,
      })
    }
    throw new ApiError('Не удалось связаться с сервером. Проверьте, что backend запущен', {
      code: ERROR_CODES.network,
      status: 0,
    })
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(payload.error.message, {
        code: payload.error.code,
        status: response.status,
        details: payload.error.details,
      })
    }
    throw new ApiError(`Ошибка сервера (HTTP ${response.status})`, {
      code: 'INTERNAL_ERROR',
      status: response.status,
    })
  }

  return payload as T
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),
}
