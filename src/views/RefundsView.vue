<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, money, relativeTime, type Transaction } from '../api'
import { onTransactionChanged } from '../realtime'
import { stateClass, label } from '../ui'

const router = useRouter()
const rows = ref<Transaction[]>([])

// A refund is a Refund-type transaction going the opposite way, whose reference records
// the original it reverses ("Refund of TXG-…"). Pull the original id back out so each
// refund links to the transaction it returned money for.
function originalId(ref: string | null): string | null {
  const m = ref?.match(/Refund of (TXG-[0-9a-fA-F-]+)/)
  return m ? m[1] : null
}

const settled = computed(() => rows.value.filter(r => r.state === 'Completed'))
const totalRefunded = computed(() => settled.value.reduce((s, r) => s + r.amountMinor, 0))
const inFlight = computed(() =>
  rows.value.filter(r => !['Completed', 'Failed', 'FraudRejected', 'DebitFailed', 'ManualReview'].includes(r.state)).length)
const failed = computed(() =>
  rows.value.filter(r => ['Failed', 'ManualReview'].includes(r.state)).length)

async function load() {
  const res = await api.listTransactions(undefined, 1, 200, 'Refund')
  rows.value = res.items
}

let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(load) })
onUnmounted(() => off?.())
</script>

<template>
  <div class="page-head">
    <div><h1>Refunds</h1><p>Every refund runs as its own durable workflow in the opposite direction — same retries and saga protection as a payment.</p></div>
  </div>

  <div class="cards">
    <div class="panel card">
      <div class="label">Total refunded</div>
      <div class="value green">{{ money(totalRefunded) }}</div>
      <div class="sub">{{ settled.length }} settled refund{{ settled.length === 1 ? '' : 's' }}</div>
    </div>
    <div class="panel card">
      <div class="label">All refunds</div>
      <div class="value">{{ rows.length }}</div>
      <div class="sub">issued to date</div>
    </div>
    <div class="panel card">
      <div class="label">In flight</div>
      <div class="value blue">{{ inFlight }}</div>
      <div class="sub">returning funds now</div>
    </div>
    <div class="panel card">
      <div class="label">Failed / escalated</div>
      <div class="value red">{{ failed }}</div>
      <div class="sub">need attention</div>
    </div>
  </div>

  <div class="panel">
    <table>
      <thead>
        <tr><th>Refund</th><th>Original</th><th>Returned to</th><th>Amount</th><th>Status</th><th>When</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in rows" :key="t.transactionId" @click="router.push(`/transactions/${t.transactionId}`)">
          <td class="mono">{{ t.transactionId.slice(0, 12) }}…</td>
          <td>
            <RouterLink v-if="originalId(t.reference)" class="mono link" :to="`/transactions/${originalId(t.reference)}`" @click.stop>
              {{ originalId(t.reference)!.slice(0, 12) }}…
            </RouterLink>
            <span v-else class="dim">—</span>
          </td>
          <td>{{ t.recipientName || '—' }}<div class="dim mono">{{ t.recipientProvider }}</div></td>
          <td>{{ money(t.amountMinor, t.currency) }}</td>
          <td><span class="badge" :class="stateClass(t.state)">{{ label(t.state) }}</span></td>
          <td class="dim">{{ relativeTime(t.createdAtUtc) }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="empty">No refunds yet. Refund a completed transaction from its detail page.</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.link { color: var(--accent, #0d9488); text-decoration: none; }
.link:hover { text-decoration: underline; }
</style>
