import axios from 'axios'
import { token, logout } from './auth'

const http = axios.create({ baseURL: '/api/v1' })

// Attach the bearer token to every request when signed in.
http.interceptors.request.use(config => {
  const t = token()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// On 401 (expired/invalid token), clear the session and bounce to login.
http.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) {
      logout()
      const here = window.location.pathname + window.location.search
      if (!here.startsWith('/login')) window.location.assign('/login?expired=1')
    }
    return Promise.reject(err)
  },
)

// ── Types mirroring the backend DTOs ────────────────────────────────────────
export interface Party {
  accountId: string; name: string; accountNumber: string; provider: string
}
export interface SubmitRequest {
  sender: Party; recipient: Party
  amountMinor: number; currency?: string
  type: 'Transfer' | 'BillPayment'
  reference?: string; idempotencyKey?: string
}
export interface Transaction {
  transactionId: string
  senderName: string; senderNumber: string; senderProvider: string
  recipientName: string; recipientNumber: string; recipientProvider: string
  amountMinor: number; currency: string; type: string
  state: string; failureReason: string | null; retries: number
  riskScore: number | null; riskLevel: string | null; fraudModelVersion: string | null
  createdAtUtc: string; updatedAtUtc: string
}
export interface AuditEvent {
  id: number; transactionId: string; eventType: string
  previousState: string | null; newState: string | null
  details: string | null; dataJson: string | null; timestampUtc: string
}
export interface TransactionDetail { transaction: Transaction; events: AuditEvent[] }
export interface Paged<T> { items: T[]; page: number; pageSize: number; total: number }
export interface Overview {
  inFlight: number; fraudQueue: number; completedToday: number
  failedOrEscalated: number; successRate: number; total: number
  stateBreakdown: Record<string, number>
}

// ── Endpoints ───────────────────────────────────────────────────────────────
export const api = {
  overview: () => http.get<Overview>('/overview').then(r => r.data),

  listTransactions: (status?: string, page = 1, pageSize = 50) =>
    http.get<Paged<Transaction>>('/transactions', { params: { status, page, pageSize } }).then(r => r.data),

  getTransaction: (id: string) =>
    http.get<TransactionDetail>(`/transactions/${id}`).then(r => r.data),

  submit: (body: SubmitRequest) =>
    http.post<{ transactionId: string; status: string; message: string }>('/transactions', body).then(r => r.data),

  fraudDecision: (id: string, decision: 'Approve' | 'Reject') =>
    http.post(`/transactions/${id}/fraud-decision`, { decision }).then(r => r.data),

  refund: (id: string, reason?: string) =>
    http.post<{ transactionId: string; originalTransactionId: string; status: string; amountMinor: number; message: string }>(
      `/transactions/${id}/refund`, { reason }).then(r => r.data),

  audit: (eventType?: string, transactionId?: string, page = 1, pageSize = 100) =>
    http.get<Paged<AuditEvent>>('/audit', { params: { eventType, transactionId, page, pageSize } }).then(r => r.data),
}

// ── Demo / chaos panel (Development only — 404s otherwise) ──────────────────
export interface DemoStatus {
  lowRiskThreshold: number; highRiskThreshold: number
  debitTransientFailureRate: number; creditTransientFailureRate: number
  creditPermanentFailureRate: number; reversalPermanentFailureRate: number
  latencyMs: number
  dbBroken: boolean; workerRunning: boolean
}
export interface BankingRates {
  debitTransientFailureRate: number; creditTransientFailureRate: number
  creditPermanentFailureRate: number; reversalPermanentFailureRate: number
  latencyMs: number
}

export const demo = {
  status: () => http.get<DemoStatus>('/demo/status').then(r => r.data),

  setFraudThresholds: (lowRiskThreshold: number, highRiskThreshold: number) =>
    http.post('/demo/fraud-thresholds', { lowRiskThreshold, highRiskThreshold }).then(r => r.data),

  setBankingRates: (rates: BankingRates) =>
    http.post('/demo/banking-rates', rates).then(r => r.data),

  breakDb: () => http.post('/demo/db/break').then(r => r.data),
  healDb: () => http.post('/demo/db/heal').then(r => r.data),
  stopWorker: () => http.post('/demo/worker/stop').then(r => r.data),
  startWorker: () => http.post('/demo/worker/start').then(r => r.data),
  reset: () => http.post('/demo/reset').then(r => r.data),
}

// ── Admin: API keys (Admin only) ────────────────────────────────────────────
export interface ApiKey {
  id: number; name: string; prefix: string; role: string; createdBy: string
  createdAtUtc: string; lastUsedAtUtc: string | null; revokedAtUtc: string | null; active: boolean
}
export interface CreatedApiKey { key: ApiKey; fullKey: string; message: string }

export const adminKeys = {
  list: () => http.get<ApiKey[]>('/admin/api-keys').then(r => r.data),
  create: (name: string) => http.post<CreatedApiKey>('/admin/api-keys', { name }).then(r => r.data),
  revoke: (id: number) => http.delete(`/admin/api-keys/${id}`).then(r => r.data),
}

// ── Formatting helpers ──────────────────────────────────────────────────────
export const money = (minor: number, currency = 'GHS') => {
  const symbol = currency === 'GHS' ? 'GH₵' : currency + ' '
  return symbol + (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const relativeTime = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
