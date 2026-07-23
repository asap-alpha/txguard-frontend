<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api, money, relativeTime, type Overview, type Transaction } from '../api'
import { onTransactionChanged } from '../realtime'
import { stateClass, riskClass, label } from '../ui'

const router = useRouter()
const overview = ref<Overview | null>(null)
const recent = ref<Transaction[]>([])

async function load() {
  overview.value = await api.overview()
  recent.value = (await api.listTransactions(undefined, 1, 8)).items
}
const breakdown = computed(() => Object.entries(overview.value?.stateBreakdown ?? {}).sort((a, b) => b[1] - a[1]))

let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(load) })
onUnmounted(() => off?.())
</script>

<template>
  <div class="page-head">
    <div><h1>Overview</h1><p>A durable view across all in-flight and terminal workflows.</p></div>
    <RouterLink class="btn btn-primary" to="/submit">Submit transaction</RouterLink>
  </div>

  <div class="cards" v-if="overview">
    <div class="panel card">
      <div class="label">Success rate</div>
      <div class="value green">{{ overview.successRate }}%</div>
      <div class="sub">of {{ overview.total }} total workflows</div>
    </div>
    <div class="panel card">
      <div class="label">In-flight</div>
      <div class="value blue">{{ overview.inFlight }}</div>
      <div class="sub">active workflows</div>
    </div>
    <div class="panel card">
      <div class="label">Fraud review</div>
      <div class="value amber">{{ overview.fraudQueue }}</div>
      <div class="sub">awaiting analyst decision</div>
    </div>
    <div class="panel card">
      <div class="label">Failed / escalated</div>
      <div class="value red">{{ overview.failedOrEscalated }}</div>
      <div class="sub">terminal failures</div>
    </div>
  </div>

  <div class="panel" style="margin-bottom:18px; padding: 14px 18px" v-if="breakdown.length">
    <div class="label" style="margin-bottom:10px">State breakdown</div>
    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <span v-for="[s, n] in breakdown" :key="s" class="badge" :class="stateClass(s)">{{ label(s) }} · {{ n }}</span>
    </div>
  </div>

  <div class="panel">
    <table>
      <thead>
        <tr><th>Transaction</th><th>Sender → Recipient</th><th>Amount</th><th>Risk</th><th>Status</th><th>When</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in recent" :key="t.transactionId" @click="router.push(`/transactions/${t.transactionId}`)">
          <td class="mono">{{ t.transactionId.slice(0, 12) }}…</td>
          <td>{{ t.senderName || '—' }} <span class="dim">→</span> {{ t.recipientName || '—' }}</td>
          <td>{{ money(t.amountMinor, t.currency) }}</td>
          <td><span class="badge" :class="riskClass(t.riskLevel)">{{ t.riskLevel ?? '—' }}<template v-if="t.riskScore != null"> {{ t.riskScore.toFixed(2) }}</template></span></td>
          <td><span class="badge" :class="stateClass(t.state)">{{ label(t.state) }}</span></td>
          <td class="dim">{{ relativeTime(t.createdAtUtc) }}</td>
        </tr>
        <tr v-if="!recent.length"><td colspan="6" class="empty">No transactions yet — submit one to get started.</td></tr>
      </tbody>
    </table>
  </div>
</template>
