import { getAuthHeader } from "./get-id-token"

/**
 * fetch() côté client avec ajout automatique du Bearer token Firebase.
 * (Ne fonctionne que dans les composants "use client".)
 */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const authHeader = await getAuthHeader()
  const headers = new Headers(init.headers || {})

  if (authHeader) headers.set("Authorization", authHeader)

  return fetch(input, {
    ...init,
    headers,
  })
}

export async function authedJsonFetch<T = any>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  body?: any,
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers = new Headers(init.headers || {})
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")

  const res = await authedFetch(input, {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : init.body,
  })

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}
