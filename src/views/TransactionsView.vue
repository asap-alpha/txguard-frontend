<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, money, relativeTime, type Transaction } from '../api'
import { onTransactionChanged } from '../realtime'
import { stateClass, riskClass, label } from '../ui'

const router = useRouter()
const rows = ref<Transaction[]>([])
const total = ref(0)
const filter = ref<string | undefined>(undefined)

const tabs = [
  { key: undefined, name: 'All' },
  { key: 'inflight', name: 'In flight' },
  { key: 'Completed', name: 'Completed' },
  { key: 'Failed', name: 'Failed' },
  { key: 'FraudReview', name: 'Fraud review' },
]
// 'inflight' isn't a single state; expand client-side.
const INFLIGHT = new Set(['Pending', 'Debiting', 'Crediting', 'CreditFailed', 'Reversing', 'FraudReview'])

async function load() {
  const single = filter.value && filter.value !== 'inflight' ? filter.value : undefined
  const res = await api.listTransactions(single, 1, 200)
  let items = res.items
  if (filter.value === 'inflight') items = items.filter(t => INFLIGHT.has(t.state))
  rows.value = items
  total.value = filter.value === 'inflight' ? items.length : res.total
}
function setFilter(k: string | undefined) { filter.value = k; load() }

let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(load) })
onUnmounted(() => off?.())
</script>

<template>
  <div class="page-head">
    <div><h1>Transactions</h1><p>{{ total }} workflows · click a row for full audit lineage.</p></div>
    <RouterLink class="btn btn-primary" to="/submit">Submit transaction</RouterLink>
  </div>

  <div class="toolbar">
    <span v-for="t in tabs" :key="t.name" class="tab" :class="{ active: filter === t.key }" @click="setFilter(t.key)">{{ t.name }}</span>
  </div>

  <div class="panel">
    <table>
      <thead>
        <tr><th>Transaction</th><th>Sender</th><th>Recipient</th><th>Amount</th><th>Risk</th><th>Status</th><th>Retries</th><th>When</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in rows" :key="t.transactionId" @click="router.push(`/transactions/${t.transactionId}`)">
          <td class="mono">{{ t.transactionId.slice(0, 12) }}…</td>
          <td>{{ t.senderName || '—' }}<div class="dim mono">{{ t.senderProvider }}</div></td>
          <td>{{ t.recipientName || '—' }}<div class="dim mono">{{ t.recipientProvider }}</div></td>
          <td>{{ money(t.amountMinor, t.currency) }}</td>
          <td><span class="badge" :class="riskClass(t.riskLevel)">{{ t.riskLevel ?? '—' }}<template v-if="t.riskScore != null"> {{ t.riskScore.toFixed(2) }}</template></span></td>
          <td><span class="badge" :class="stateClass(t.state)">{{ label(t.state) }}</span></td>
          <td>{{ t.retries }}</td>
          <td class="dim">{{ relativeTime(t.createdAtUtc) }}</td>
        </tr>
        <tr v-if="!rows.length"><td colspan="8" class="empty">No transactions match this filter.</td></tr>
      </tbody>
    </table>
  </div>
</template>
