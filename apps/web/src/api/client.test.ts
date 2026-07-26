import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, buildQuery, request } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildQuery', () => {
  it('serializes present values', () => {
    expect(buildQuery({ page: 2, search: 'test' })).toBe('?page=2&search=test')
  })

  it('skips null, undefined and blank values', () => {
    expect(buildQuery({ a: null, b: undefined, c: '', d: '   ', e: 1 })).toBe('?e=1')
  })

  it('returns an empty string when nothing remains', () => {
    expect(buildQuery({ a: null })).toBe('')
  })
})

describe('request', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 7 })))

    await expect(request<{ id: number }>('/reels/7')).resolves.toEqual({ id: 7 })
  })

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(request('/competitors/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('sends a JSON body for mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/competitors', { method: 'POST', body: { profile: 'example' } })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ profile: 'example' }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('maps the unified error envelope to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'COMPETITOR_ALREADY_EXISTS',
              message: 'Этот Instagram-аккаунт уже добавлен',
              details: { instagramUsername: 'example' },
            },
          },
          409,
        ),
      ),
    )

    const error = await request('/competitors', { method: 'POST' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('COMPETITOR_ALREADY_EXISTS')
    expect(apiError.status).toBe(409)
    expect(apiError.message).toBe('Этот Instagram-аккаунт уже добавлен')
    expect(apiError.details.instagramUsername).toBe('example')
  })

  it('falls back to a generic message for a non-JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>500</html>', { status: 500 })),
    )

    const error = (await request('/reels').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(500)
    expect(error.message).toContain('500')
  })

  it('converts a network failure into a friendly ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = (await request('/reels').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
    expect(error.message).toContain('backend')
  })

  it('propagates an external abort instead of masking it', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        })
      }),
    )

    const promise = request('/reels', { signal: controller.signal })
    controller.abort()

    const error = (await promise.catch((e: unknown) => e)) as Error
    expect(error).not.toBeInstanceOf(ApiError)
    expect(error.name).toBe('AbortError')
  })

  it('aborts the request when the timeout elapses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Timeout', 'TimeoutError')),
          )
        })
      }),
    )

    const error = (await request('/reels', { timeoutMs: 5 }).catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.isNetworkError).toBe(true)
  })
})
