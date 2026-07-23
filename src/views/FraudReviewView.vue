<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, money, relativeTime, type Transaction } from '../api'
import { onTransactionChanged } from '../realtime'
import { riskColor } from '../ui'

const router = useRouter()
const queue = ref<Transaction[]>([])
const busy = ref<string | null>(null)

async function load() {
  queue.value = (await api.listTransactions('FraudReview', 1, 100)).items
}
async function decide(id: string, decision: 'Approve' | 'Reject') {
  busy.value = id
  try { await api.fraudDecision(id, decision); await load() } finally { busy.value = null }
}

let off: (() => void) | undefined
onMounted(() => { load(); off = onTransactionChanged(load) })
onUnmounted(() => off?.())
</script>

<template>
  <div class="page-head">
    <div><h1>Fraud Review</h1><p>High-risk transactions held for a human decision. Approving resumes the durable workflow.</p></div>
  </div>

  <div v-if="!queue.length" class="panel empty">🎉 The fraud queue is clear — no transactions awaiting review.</div>

  <div v-for="t in queue" :key="t.transactionId" class="panel card" style="margin-bottom:14px">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap">
      <div>
        <div class="mono" style="cursor:pointer" @click="router.push(`/transactions/${t.transactionId}`)">{{ t.transactionId.slice(0, 20) }}…</div>
        <div style="margin-top:6px">{{ t.senderName || '—' }} <span class="dim">({{ t.senderProvider }})</span> → {{ t.recipientName || '—' }} <span class="dim">({{ t.recipientProvider }})</span></div>
        <div class="dim" style="margin-top:4px">{{ money(t.amountMinor, t.currency) }} · {{ relativeTime(t.createdAtUtc) }}</div>
      </div>
      <div style="text-align:center">
        <div class="dim" style="font-size:12px; margin-bottom:4px">Risk score</div>
        <div style="font-size:26px; font-weight:700" :style="{ color: riskColor(t.riskScore) }">{{ t.riskScore?.toFixed(2) }}</div>
        <div class="dim mono" style="font-size:11px">{{ t.fraudModelVersion }}</div>
      </div>
      <div style="display:flex; gap:10px">
        <button class="btn-approve" :disabled="busy === t.transactionId" @click="decide(t.transactionId, 'Approve')">Approve</button>
        <button class="btn-reject" :disabled="busy === t.transactionId" @click="decide(t.transactionId, 'Reject')">Reject</button>
      </div>
    </div>
  </div>
</template>
