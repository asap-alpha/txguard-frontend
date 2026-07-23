import { computed, reactive } from 'vue'
import axios from 'axios'
import { API_BASE } from './config'

export type Role = 'Admin' | 'Analyst' | 'Integrator'

export interface Session {
  token: string
  username: string
  displayName: string
  role: Role
  expiresAtUtc: string
}

const STORAGE_KEY = 'txguard.session'

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (new Date(s.expiresAtUtc).getTime() <= Date.now()) return null   // expired
    return s
  } catch { return null }
}

const state = reactive<{ session: Session | null }>({ session: load() })

export const session = computed(() => state.session)
export const isAuthenticated = computed(() => state.session !== null)
export const role = computed<Role | null>(() => state.session?.role ?? null)

/** True if the current session holds any of the given roles. */
export function hasRole(...roles: Role[]) {
  return state.session !== null && roles.includes(state.session.role)
}

/** Convenience capability flags mirroring the backend RBAC gates. */
export const can = {
  submit: () => hasRole('Integrator', 'Admin'),
  refund: () => hasRole('Integrator', 'Admin'),
  decideFraud: () => hasRole('Analyst', 'Admin'),
  demo: () => hasRole('Admin'),
}

export async function login(username: string, password: string): Promise<void> {
  const { data } = await axios.post<Session>(`${API_BASE}/api/v1/auth/login`, { username, password })
  state.session = data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function logout(): void {
  state.session = null
  localStorage.removeItem(STORAGE_KEY)
}

export function token(): string | null {
  return state.session?.token ?? null
}
