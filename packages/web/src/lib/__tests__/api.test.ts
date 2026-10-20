import { api } from '../api'

type FetchArgs = [string, RequestInit]

function mockFetch(handler: (url: string, init: RequestInit) => unknown) {
  const spy = jest.fn(async (url: string, init: RequestInit) => {
    const result = handler(url, init)
    return {
      ok: true,
      status: 200,
      json: async () => result,
    } as Response
  })
  global.fetch = spy as unknown as typeof fetch
  return spy
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('collection URL normalisation', () => {
  it.each([
    ['/courses', '/courses/'],
    ['/courses?limit=50', '/courses/?limit=50'],
    ['/users?skip=0&limit=10', '/users/?skip=0&limit=10'],
    ['/enrollments', '/enrollments/'],
    ['/notifications', '/notifications/'],
    ['/notifications?unread_only=true', '/notifications/?unread_only=true'],
    ['/announcements/', '/announcements/'],
  ])('turns %j into %j', async (called, expected) => {
    const spy = mockFetch(() => ({ ok: true }))
    await api.get(called)
    const [url] = spy.mock.calls[0] as FetchArgs
    expect(url.endsWith(expected)).toBe(true)
  })

  it.each([
    ['/users/me'],
    ['/courses/abc123'],
    ['/enrollments/my-assignments'],
    ['/courses/lessons/course/abc'],
    ['/auth/login'],
  ])('leaves %j alone', async (path) => {
    const spy = mockFetch(() => ({ ok: true }))
    await api.get(path)
    const [url] = spy.mock.calls[0] as FetchArgs
    expect(url.endsWith(path)).toBe(true)
  })
})

describe('timeouts and cancellation', () => {
  it('aborts a request that never answers and reports the timeout', async () => {
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as unknown as typeof fetch

    const response = await api.get('/courses', { timeoutMs: 50 })
    expect(response).toEqual({ error: 'Request timed out' })
  })

  it('reports a caller cancellation as cancelled, not as a timeout', async () => {
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as unknown as typeof fetch

    const controller = new AbortController()
    const pending = api.get('/courses', { signal: controller.signal, timeoutMs: 10_000 })
    controller.abort()

    const response = await pending
    expect(response).toEqual({ error: 'Request cancelled' })
  })

  it('returns the parsed body on success', async () => {
    mockFetch(() => [{ id: 'course-1' }])
    const response = await api.get('/courses/')
    expect(response).toEqual({ data: [{ id: 'course-1' }] })
  })

  it('surfaces the API error message', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ detail: "You don't own this assignment" }),
    })) as unknown as typeof fetch

    const response = await api.post('/courses/assignments', {})
    expect(response).toEqual({ error: "You don't own this assignment" })
  })
})
