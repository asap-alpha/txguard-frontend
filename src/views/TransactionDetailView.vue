<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, money, relativeTime, type TransactionDetail } from '../api'
import { onTransactionChanged } from '../realtime'
import { stateClass, riskClass, label, eventLabel, eventTone, riskColor } from '../ui'
import { can } from '../auth'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const data = ref<TransactionDetail | null>(null)
const busy = ref(false)
const refundReason = ref('')
const refundError = ref('')

async function load() { data.value = await api.getTransaction(id) }

/**
 * A Failed transfer whose debit was reversed is the *safe* failure: the money went
 * back to the sender, nothing was lost. We surface that explicitly so "Failed" (header)
 * and "Debit Reversed" (timeline) stop looking contradictory. If the reversal itself
 * failed, the loss is escalated to a human instead — not silently reversed.
 */
const debitReversed = computed(() => data.value?.events.some(e => e.eventType === 'DebitReversed') ?? false)
const reversalFailed = computed(() => data.value?.events.some(e => e.eventType === 'ReversalFailed') ?? false)
async function decide(decision: 'Approve' | 'Reject') {
  busy.value = true
  try { await api.fraudDecision(id, decision); await load() } finally { busy.value = false }
}

async function refund() {
  busy.value = true; refundError.value = ''
  try {
    const res = await api.refund(id, refundReason.value || undefined)
    router.push(`/transactions/${res.transactionId}`)   // follow the new refund transaction
  } catch (e: any) {
    refundError.value = e?.response?.data?.message ?? 'Refund failed'
  } finally { busy.value = false }
}

let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(txId => { if (txId === id) load() }) })
onUnmounted(() => off?.())
</script>

<template>
  <template v-if="data">
    <div class="page-head">
      <div>
        <h1 style="display:flex; align-items:center; gap:10px">
          <span class="mono" style="font-size:15px">{{ id.slice(0, 20) }}…</span>
          <span class="badge" :class="stateClass(data.transaction.state)">{{ label(data.transaction.state) }}</span>
          <span v-if="data.refund" class="badge b-purple">Refunded</span>
        </h1>
        <p>{{ data.transaction.senderName || '—' }} → {{ data.transaction.recipientName || '—' }} · {{ money(data.transaction.amountMinor, data.transaction.currency) }}</p>
      </div>
      <RouterLink class="btn" to="/transactions">← Back</RouterLink>
    </div>

    <!-- Analyst decision panel when held in fraud review -->
    <div class="panel card" v-if="data.transaction.state === 'FraudReview' && can.decideFraud()" style="margin-bottom:16px; border-color: color-mix(in srgb, var(--amber) 40%, var(--border))">
      <div class="label" style="color:var(--amber)">⚑ Held for fraud review</div>
      <p class="dim" style="margin:8px 0 14px">
        ML risk score {{ data.transaction.riskScore?.toFixed(2) }} ({{ data.transaction.fraudModelVersion }}) exceeded the high-risk threshold.
        The workflow is durably paused awaiting your decision.
      </p>
      <div style="display:flex; gap:10px">
        <button class="btn-approve" :disabled="busy" @click="decide('Approve')">Approve — continue</button>
        <button class="btn-reject" :disabled="busy" @click="decide('Reject')">Reject — terminate</button>
      </div>
    </div>

    <!-- Already refunded: show the refund leg up front instead of only failing a re-refund. -->
    <div class="panel card" v-if="data.refund && data.transaction.type !== 'Refund'" style="margin-bottom:16px">
      <div class="label">Refund</div>
      <p class="dim" style="margin:8px 0 0; display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        This transaction has already been refunded via
        <RouterLink class="mono" :to="`/transactions/${data.refund.transactionId}`">{{ data.refund.transactionId.slice(0, 24) }}…</RouterLink>
        <span class="badge" :class="stateClass(data.refund.state)">{{ label(data.refund.state) }}</span>
      </p>
    </div>

    <!-- Refund panel: a Completed transaction that has not yet been refunded. -->
    <div class="panel card" v-else-if="data.transaction.state === 'Completed' && data.transaction.type !== 'Refund' && can.refund()" style="margin-bottom:16px">
      <div class="label">Refund</div>
      <p class="dim" style="margin:8px 0 12px">
        Returns {{ money(data.transaction.amountMinor, data.transaction.currency) }} to
        {{ data.transaction.senderName || 'the sender' }}. Starts a new durable transaction in the
        opposite direction — with the same fraud check, retries and saga protection.
      </p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">
        <input v-model="refundReason" placeholder="Reason (optional)" style="flex:1; min-width:220px" />
        <button class="btn-reject" :disabled="busy" @click="refund">{{ busy ? 'Processing…' : 'Refund transaction' }}</button>
      </div>
      <p v-if="refundError" style="color:var(--red); margin-top:10px">{{ refundError }}</p>
    </div>

    <div class="cards">
      <div class="panel card"><div class="label">Amount</div><div class="value" style="font-size:22px">{{ money(data.transaction.amountMinor, data.transaction.currency) }}</div></div>
      <div class="panel card">
        <div class="label">Risk</div>
        <div style="display:flex; align-items:center; gap:10px; margin-top:8px">
          <span class="badge" :class="riskClass(data.transaction.riskLevel)">{{ data.transaction.riskLevel ?? '—' }}</span>
          <span class="risk-meter"><span :style="{ width: ((data.transaction.riskScore ?? 0) * 100) + '%', background: riskColor(data.transaction.riskScore) }"></span></span>
          <span class="dim mono">{{ data.transaction.riskScore?.toFixed(2) ?? '—' }}</span>
        </div>
      </div>
      <div class="panel card"><div class="label">Retries</div><div class="value" style="font-size:22px">{{ data.transaction.retries }}</div></div>
      <div class="panel card"><div class="label">Type</div><div class="value" style="font-size:22px">{{ label(data.transaction.type) }}</div></div>
    </div>

    <div v-if="data.transaction.failureReason" class="panel card" style="margin-bottom:16px; color:var(--red)">
      <div class="label" style="color:var(--red)">Failure reason</div>{{ data.transaction.failureReason }}

      <!-- Reconcile a "Failed" transfer with a "Debit Reversed" step: explain that the
           reversal is what protected the money, so the two aren't contradictory. -->
      <p v-if="debitReversed && !reversalFailed" class="outcome-note ok">
        The transfer didn’t complete, but the debit was automatically reversed —
        {{ money(data.transaction.amountMinor, data.transaction.currency) }} was returned to
        {{ data.transaction.senderName || 'the sender' }}. No funds were lost.
      </p>
      <p v-else-if="reversalFailed" class="outcome-note bad">
        The transfer failed and the automatic reversal could not be confirmed, so this was
        escalated to a human for manual review — the loss is never left silent.
      </p>
    </div>

    <div class="panel card">
      <div class="label" style="margin-bottom:14px">Audit lineage · Temporal event history</div>
      <div class="timeline">
        <div class="tl-item" :class="'tone-' + eventTone(e.eventType)" v-for="e in data.events" :key="e.id">
          <div class="tl-type">{{ eventLabel(e.eventType) }}
            <span v-if="e.previousState && e.newState && e.previousState !== e.newState" class="dim" style="font-weight:400">
              · {{ label(e.previousState) }} → {{ label(e.newState) }}
            </span>
          </div>
          <div class="tl-meta">{{ e.details }} · {{ relativeTime(e.timestampUtc) }}</div>
        </div>
      </div>
    </div>
  </template>
  <div v-else class="empty">Loading…</div>
</template>

<style scoped>
/* Semantic timeline dots: successes read green, failures red, recovery steps amber. */
.tl-item.tone-ok::before   { background: var(--green); }
.tl-item.tone-bad::before  { background: var(--red); }
.tl-item.tone-warn::before { background: var(--amber); }
.tl-item.tone-info::before { background: var(--accent); }
.tl-item.tone-bad  .tl-type { color: var(--red); }
.tl-item.tone-warn .tl-type { color: var(--amber); }

/* Plain-language outcome, so "Failed" + "Debit Reversed" no longer look contradictory. */
.outcome-note {
  margin: 12px 0 0; padding: 10px 12px; border-radius: 8px;
  font-size: 13px; line-height: 1.5; border: 1px solid var(--border);
}
.outcome-note.ok {
  color: var(--green); border-color: color-mix(in srgb, var(--green) 45%, var(--border));
  background: color-mix(in srgb, var(--green) 8%, transparent);
}
.outcome-note.bad {
  color: var(--amber); border-color: color-mix(in srgb, var(--amber) 45%, var(--border));
  background: color-mix(in srgb, var(--amber) 8%, transparent);
}
</style>
