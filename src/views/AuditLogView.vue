<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, relativeTime, type AuditEvent } from '../api'
import { onTransactionChanged } from '../realtime'
import { eventLabel, label, stateClass } from '../ui'

const router = useRouter()
const events = ref<AuditEvent[]>([])
const total = ref(0)
const eventType = ref<string | undefined>(undefined)

const TYPES = ['TransactionCreated', 'FraudScored', 'FraudReviewQueued', 'FraudApproved', 'FraudRejected',
  'DebitInitiated', 'DebitSucceeded', 'DebitFailed', 'CreditInitiated', 'CreditSucceeded', 'CreditFailed',
  'RetryScheduled', 'ReversalInitiated', 'DebitReversed', 'ManualReviewEscalated', 'TransactionCompleted']

async function load() {
  const res = await api.audit(eventType.value, undefined, 1, 150)
  events.value = res.items; total.value = res.total
}
let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(load) })
onUnmounted(() => off?.())
</script>

<template>
  <div class="page-head">
    <div><h1>Audit Log</h1><p>Tamper-evident event history — {{ total }} events. Source of truth: Temporal event history.</p></div>
  </div>

  <div class="toolbar">
    <select style="max-width:260px" v-model="eventType" @change="load">
      <option :value="undefined">All event types</option>
      <option v-for="t in TYPES" :key="t" :value="t">{{ eventLabel(t) }}</option>
    </select>
  </div>

  <div class="panel">
    <table>
      <thead><tr><th>Time</th><th>Event</th><th>Transaction</th><th>Transition</th><th>Details</th></tr></thead>
      <tbody>
        <tr v-for="e in events" :key="e.id" @click="router.push(`/transactions/${e.transactionId}`)">
          <td class="dim">{{ relativeTime(e.timestampUtc) }}</td>
          <td class="mono">{{ eventLabel(e.eventType) }}</td>
          <td class="mono dim">{{ e.transactionId.slice(0, 12) }}…</td>
          <td>
            <span v-if="e.previousState && e.newState && e.previousState !== e.newState">
              <span class="badge b-gray">{{ label(e.previousState) }}</span> →
              <span class="badge" :class="stateClass(e.newState)">{{ label(e.newState) }}</span>
            </span>
            <span v-else class="dim">—</span>
          </td>
          <td class="dim">{{ e.details }}</td>
        </tr>
        <tr v-if="!events.length"><td colspan="5" class="empty">No events for this filter.</td></tr>
      </tbody>
    </table>
  </div>
</template>
