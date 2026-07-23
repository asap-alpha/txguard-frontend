// Maps transaction states and risk levels to badge colour classes.

const STATE_CLASS: Record<string, string> = {
  Pending: 'b-blue', FraudReview: 'b-amber', FraudRejected: 'b-red',
  Debiting: 'b-blue', DebitFailed: 'b-red', Crediting: 'b-blue',
  Completed: 'b-green', CreditFailed: 'b-orange', Reversing: 'b-orange',
  Failed: 'b-red', ManualReview: 'b-purple',
}

export const stateClass = (s: string) => STATE_CLASS[s] ?? 'b-gray'

export const riskClass = (level: string | null) =>
  level === 'High' ? 'b-red' : level === 'Medium' ? 'b-amber' : level === 'Low' ? 'b-green' : 'b-gray'

export const riskColor = (score: number | null) =>
  score == null ? 'var(--muted)' : score >= 0.8 ? 'var(--red)' : score >= 0.4 ? 'var(--amber)' : 'var(--green)'

// Human-friendly label, e.g. "DebitFailed" -> "Debit failed"
export const label = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')

// Event type -> label, e.g. DEBIT_SUCCEEDED already upper — keep readable
export const eventLabel = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2')
