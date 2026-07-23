// Validation for a Party's accountNumber. The accepted format depends on that
// party's OWN provider — a MoMo wallet is addressed by Ghana MSISDN, a bank
// account by its account number. The counterparty's provider is irrelevant.

export type ProviderKind = 'momo' | 'bank'

/** Single source of truth for the provider dropdown and its validation rule. */
export const PROVIDERS: ReadonlyArray<{ name: string; kind: ProviderKind }> = [
  { name: 'MTN MoMo', kind: 'momo' },
  { name: 'Telecel', kind: 'momo' },
  { name: 'GCB Bank', kind: 'bank' },
  { name: 'Ecobank', kind: 'bank' },
]

// Unknown providers fall back to the looser bank rule rather than rejecting
// outright, so adding a provider to the backend can't block submissions here.
export function providerKind(provider: string): ProviderKind {
  return PROVIDERS.find(p => p.name === provider)?.kind ?? 'bank'
}

// MTN / AirtelTigo / Telecel mobile prefixes per the NCA numbering plan.
const NETWORK_CODES = [
  '20', '23', '24', '25', '26', '27', '28', '29',
  '50', '53', '54', '55', '56', '57', '58', '59',
]

// Ghanaian bank account numbers vary by bank (GCB 13, Ecobank 13, others 10-16),
// so we bound the length rather than hardcoding a rule per bank.
const BANK_MIN_DIGITS = 10
const BANK_MAX_DIGITS = 16

/** Strips spaces, dashes and parentheses. */
function clean(raw: string): string {
  return raw.replace(/[\s()-]/g, '')
}

/**
 * Returns a Ghana mobile number in local 10-digit form (0XXXXXXXXX), or null if
 * it is not a valid Ghanaian mobile number.
 */
export function normalizeGhanaNumber(raw: string): string | null {
  let n = clean(raw)
  if (n.startsWith('+233')) n = '0' + n.slice(4)
  else if (n.startsWith('233')) n = '0' + n.slice(3)

  if (!/^0\d{9}$/.test(n)) return null
  if (!NETWORK_CODES.includes(n.slice(1, 3))) return null
  return n
}

function normalizeBankAccount(raw: string): string | null {
  const n = clean(raw)
  return new RegExp(`^\\d{${BANK_MIN_DIGITS},${BANK_MAX_DIGITS}}$`).test(n) ? n : null
}

/** Canonical form to send to the backend, or null when invalid. */
export function normalizeAccountNumber(raw: string, provider: string): string | null {
  return providerKind(provider) === 'momo'
    ? normalizeGhanaNumber(raw)
    : normalizeBankAccount(raw)
}

/** Human-readable reason the number is rejected, or '' when it is valid. */
export function accountNumberError(raw: string, provider: string): string {
  const n = clean(raw)
  if (!n) return 'Account number is required'
  if (normalizeAccountNumber(n, provider)) return ''

  if (providerKind(provider) === 'momo') {
    if (/[^\d+]/.test(n)) return 'Mobile number must contain digits only'
    return 'Enter a valid Ghana mobile number, e.g. 0244123456 or +233244123456'
  }
  if (/\D/.test(n)) return 'Account number must contain digits only'
  return `Enter a valid ${provider} account number (${BANK_MIN_DIGITS}–${BANK_MAX_DIGITS} digits)`
}

/** Label for the number field, which changes meaning with the provider. */
export function accountLabel(provider: string): string {
  return providerKind(provider) === 'momo' ? 'number' : 'account number'
}
