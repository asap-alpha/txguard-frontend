<script setup lang="ts">
// Static integrator-facing API reference. Kept in-app so an admin can walk a partner
// through it or copy snippets; the live/interactive spec is Swagger at /swagger.
import CodeBlock from '../components/CodeBlock.vue'

const base = `${window.location.origin}/api/v1`

// ── Copyable snippets ───────────────────────────────────────────────────────
const submitBody = `{
  "sender": {
    "accountId": "acc-0244123456",
    "name": "Ama Owusu",
    "accountNumber": "0244123456",
    "provider": "MTN"
  },
  "recipient": {
    "accountId": "acc-0209876543",
    "name": "Kofi Mensah",
    "accountNumber": "0209876543",
    "provider": "Vodafone"
  },
  "amountMinor": 5000,
  "currency": "GHS",
  "type": "Transfer",
  "reference": "invoice-8842",
  "idempotencyKey": "your-unique-ref-8842"
}`

const submitResponse = `{
  "transactionId": "TXG-1a2b...",
  "status": "Pending",
  "message": "Transaction accepted"
}`

const statusResponse = `{
  "transaction": {
    "transactionId": "TXG-1a2b...",
    "amountMinor": 5000,
    "currency": "GHS",
    "type": "Transfer",
    "state": "Completed",
    "failureReason": null,
    "retries": 1,
    "riskScore": 0.20,
    "riskLevel": "Low",
    "createdAtUtc": "2026-07-21T...",
    "updatedAtUtc": "2026-07-21T..."
  },
  "events": [
    { "eventType": "TransactionCreated" },
    { "eventType": "FraudScored" },
    { "eventType": "DebitSucceeded" },
    { "eventType": "CreditSucceeded" },
    { "eventType": "TransactionCompleted" }
  ]
}`

const refundBody = `{ "reason": "customer request" }`

const refundResponse = `{
  "transactionId": "TXG-9f8e...",
  "originalTransactionId": "TXG-1a2b...",
  "status": "Pending",
  "amountMinor": 5000,
  "message": "Refund accepted"
}`

const errorExample = `{
  "code": "TXG-003",
  "message": "Idempotency key already exists; original returned",
  "transactionId": "TXG-1a2b..."
}`

const curlSubmit = `curl -X POST ${base}/transactions \\
  -H "X-Api-Key: txg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "sender": {"accountId":"acc-1","name":"Ama","accountNumber":"0244123456","provider":"MTN"},
    "recipient": {"accountId":"acc-2","name":"Kofi","accountNumber":"0209876543","provider":"Vodafone"},
    "amountMinor": 5000,
    "type": "Transfer",
    "idempotencyKey": "ref-8842"
  }'`

const curlPoll = `curl ${base}/transactions/TXG-1a2b... \\
  -H "X-Api-Key: txg_live_..."`

const curlRefund = `curl -X POST ${base}/transactions/TXG-1a2b.../refund \\
  -H "X-Api-Key: txg_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"reason":"customer request"}'`

const states = [
  ['Pending', 'Accepted; workflow started', 'no'],
  ['FraudReview', 'Held for a human decision (risk ≥ high threshold)', 'no'],
  ['FraudRejected', 'Analyst rejected — no funds moved', 'yes'],
  ['Debiting', 'Debit executing / retrying', 'no'],
  ['DebitFailed', 'Debit failed permanently', 'yes'],
  ['Crediting', 'Credit executing / retrying', 'no'],
  ['Completed', 'Debit + credit succeeded', 'yes'],
  ['CreditFailed', 'Credit exhausted — moving to reversal', 'no'],
  ['Reversing', 'Compensating reversal executing', 'no'],
  ['Failed', 'Rolled back after credit failure (money returned)', 'yes'],
  ['ManualReview', 'Reversal also failed — escalated to a human', 'yes'],
]

const errors = [
  ['TXG-AUTH', '401', 'Missing/invalid credentials or API key'],
  ['TXG-INVALID', '400 / 409', 'Validation failure or illegal operation'],
  ['TXG-003', '409', 'Idempotency key already used; original returned'],
  ['TXG-007', '400', 'Amount exceeds configured maximum'],
  ['TXG-008', '404', 'Transaction id not found'],
]
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Integration guide</h1>
      <p>How a partner integrates with TxGuard. The interactive spec lives at
        <a :href="`${base.replace('/api/v1','')}/swagger`" target="_blank">/swagger</a>.</p>
    </div>
  </div>

  <!-- Auth -->
  <section class="panel card doc">
    <h2>1 · Authentication</h2>
    <p>Every request (except <code>/health</code>) requires auth. Machine integrators use an
      <strong>API key</strong> issued from the <RouterLink to="/api-keys">API Keys</RouterLink> screen,
      sent on every request:</p>
    <CodeBlock code="X-Api-Key: txg_live_9a2cc15d33a2..." />
    <p class="dim">The key authenticates as the <strong>Integrator</strong> role: it may submit, refund, and read.
      Keys are shown once at creation and can be revoked at any time (a revoked key returns <code>401</code>).</p>
    <p>Base URL: <code>{{ base }}</code></p>
  </section>

  <!-- Lifecycle -->
  <section class="panel card doc">
    <h2>2 · Transaction lifecycle</h2>
    <p>A submission starts a durable workflow. Fraud scoring runs <em>before</em> any funds move; a permanent
      credit failure auto-reverses the debit (saga compensation), so money is never silently lost.</p>
    <pre class="flow">Partner ──POST /transactions (your idempotencyKey)──► TxGuard
                                                    │ FraudScored   (before any funds move)
                                                    │ Debit   ─► sender rail      (key TXG-x)
                                                    │ Credit  ─► terminating co   (key TXG-x-credit)
                                                    │    ├─ ok         → Completed
                                                    │    └─ permanent  → Reverse (TXG-x-reversal) → Failed
Partner ◄── GET /transactions/{id} (poll status) ───┘</pre>
    <p class="dim"><strong>Important:</strong> submission is asynchronous. <code>200</code> means
      <em>accepted</em> (state <code>Pending</code>), not settled. Poll <code>GET /transactions/{id}</code>
      until a terminal state. (Outbound webhooks are on the roadmap; today you poll.)</p>
  </section>

  <!-- Submit -->
  <section class="panel card doc">
    <h2>3 · Submit a transaction</h2>
    <p><span class="verb post">POST</span> <code>/transactions</code> — roles: Integrator, Admin</p>
    <p class="dim">Amounts are integer <strong>minor units</strong> (pesewas): GH₵50.00 = <code>5000</code>.
      Always send your own <code>idempotencyKey</code> so retries are safe.</p>
    <div class="cols">
      <div>
        <div class="lbl">Request</div>
        <CodeBlock :code="submitBody" />
      </div>
      <div>
        <div class="lbl">200 Response</div>
        <CodeBlock :code="submitResponse" />
        <div class="lbl">Other responses</div>
        <ul class="resp">
          <li><code>400 TXG-007</code> — amount over the maximum</li>
          <li><code>400 TXG-INVALID</code> — validation error</li>
          <li><code>409 TXG-003</code> — duplicate idempotency key (original returned)</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- Status -->
  <section class="panel card doc">
    <h2>4 · Get status &amp; audit trail</h2>
    <p><span class="verb get">GET</span> <code>/transactions/{id}</code> — any authenticated caller</p>
    <div class="cols">
      <div>
        <div class="lbl">200 Response</div>
        <CodeBlock :code="statusResponse" />
      </div>
      <div>
        <div class="lbl">Poll until terminal</div>
        <p class="dim">Keep polling while the state is non-terminal. <code>404 TXG-008</code> if the id is unknown.</p>
        <div class="lbl">List (paged)</div>
        <p><span class="verb get">GET</span> <code>/transactions?status=&amp;page=&amp;pageSize=</code></p>
      </div>
    </div>
  </section>

  <!-- Refund -->
  <section class="panel card doc">
    <h2>5 · Refund a transaction</h2>
    <p><span class="verb post">POST</span> <code>/transactions/{id}/refund</code> — roles: Integrator, Admin</p>
    <p class="dim">Refunds the <strong>full amount</strong> of a <code>Completed</code> transaction by starting a new
      durable transaction in the opposite direction. Also asynchronous — poll the returned id.</p>
    <div class="cols">
      <div>
        <div class="lbl">Request (optional body)</div>
        <CodeBlock :code="refundBody" />
        <div class="lbl" style="margin-top:10px">curl</div>
        <CodeBlock :code="curlRefund" />
      </div>
      <div>
        <div class="lbl">200 Response</div>
        <CodeBlock :code="refundResponse" />
        <ul class="resp">
          <li><code>409 TXG-INVALID</code> — original not Completed</li>
          <li><code>409 TXG-003</code> — already refunded</li>
          <li><code>404 TXG-008</code> — original not found</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- States -->
  <section class="panel card doc">
    <h2>6 · Transaction states</h2>
    <table class="tbl">
      <thead><tr><th>State</th><th>Meaning</th><th>Terminal?</th></tr></thead>
      <tbody>
        <tr v-for="s in states" :key="s[0]">
          <td><code>{{ s[0] }}</code></td>
          <td class="dim">{{ s[1] }}</td>
          <td><span class="badge" :class="s[2] === 'yes' ? 'ok' : ''">{{ s[2] === 'yes' ? 'terminal' : 'in-flight' }}</span></td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Errors -->
  <section class="panel card doc">
    <h2>7 · Error format</h2>
    <p>All errors share one shape:</p>
    <CodeBlock :code="errorExample" />
    <table class="tbl">
      <thead><tr><th>Code</th><th>HTTP</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr v-for="e in errors" :key="e[0]"><td><code>{{ e[0] }}</code></td><td>{{ e[1] }}</td><td class="dim">{{ e[2] }}</td></tr>
      </tbody>
    </table>
  </section>

  <!-- curl -->
  <section class="panel card doc">
    <h2>8 · Quick start (curl)</h2>
    <div class="lbl">Submit a transaction</div>
    <CodeBlock :code="curlSubmit" />
    <div class="lbl" style="margin-top:12px">Poll for status</div>
    <CodeBlock :code="curlPoll" />
    <p class="dim" style="margin-top:10px">Replace <code>txg_live_...</code> with a key from the
      <RouterLink to="/api-keys">API Keys</RouterLink> screen, and the id with the one returned by submit.</p>
  </section>
</template>

<style scoped>
.doc { margin-bottom: 16px; }
.doc h2 { font-size: 16px; margin: 0 0 10px; }
.doc p { margin: 0 0 10px; line-height: 1.6; }
pre { background: color-mix(in srgb, var(--muted) 12%, transparent); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font-size: 12.5px; line-height: 1.5; white-space: pre; }
pre.flow { font-size: 12px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
.lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin: 6px 0; }
.verb { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; margin-right: 6px; }
.verb.post { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
.verb.get { background: color-mix(in srgb, #60a5fa 22%, transparent); color: #60a5fa; }
.resp { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--muted); line-height: 1.7; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 6px 10px; border-bottom: 1px solid var(--border); }
.tbl td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
.badge.ok { color: var(--green, #4ade80); }
</style>
