import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { useCallback } from 'react'

/**
 * Returns an api helper that automatically attaches the current session token.
 */
export function useApi() {
  const { session } = useAuth()
  const token = session?.access_token

  const get = useCallback(
    <T>(path: string) => api.get<T>(path, token),
    [token]
  )

  const post = useCallback(
    <T>(path: string, data: unknown) => api.post<T>(path, data, token),
    [token]
  )

  const put = useCallback(
    <T>(path: string, data: unknown) => api.put<T>(path, data, token),
    [token]
  )

  const del = useCallback(
    <T>(path: string) => api.delete<T>(path, token),
    [token]
  )

  return { get, post, put, del }
}
