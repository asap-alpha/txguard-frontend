<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { demo, type BankingRates, type DemoStatus } from '../api'

const status = ref<DemoStatus | null>(null)
const unavailable = ref(false)
const busy = ref('')
const note = ref('')

/** Editable copy of the banking rates, so every knob is visible and tunable. */
const rates = ref<BankingRates>({
  debitTransientFailureRate: 0, creditTransientFailureRate: 0,
  creditPermanentFailureRate: 0, reversalPermanentFailureRate: 0, latencyMs: 150,
})
/**
 * The form is user-owned: we seed it from the server ONCE (first load, or after a
 * reset re-arms this flag), then never let the background poll stomp what the admin
 * typed or applied. The live server-side values stay visible via the "Active" readout
 * below, so nothing is hidden — the inputs just stop silently snapping back.
 */
const formSeeded = ref(false)

/** Copies the five banking-rate fields off a status/response payload. */
function pickRates(s: BankingRates): BankingRates {
  return {
    debitTransientFailureRate: s.debitTransientFailureRate,
    creditTransientFailureRate: s.creditTransientFailureRate,
    creditPermanentFailureRate: s.creditPermanentFailureRate,
    reversalPermanentFailureRate: s.reversalPermanentFailureRate,
    latencyMs: s.latencyMs,
  }
}

async function refresh() {
  try {
    const s = await demo.status()
    status.value = s
    // Seed the editable form from the server only until the admin first touches it;
    // after that the form holds what THEY set and the poll only updates the readout.
    if (!formSeeded.value) {
      rates.value = pickRates(s)
      formSeeded.value = true
    }
    unavailable.value = false
  } catch (e: any) {
    // 404 => not running in Development; anything else => API down
    unavailable.value = true
  }
}

/** Runs an action, shows what it demonstrates, then refreshes state. */
async function run(key: string, fn: () => Promise<unknown>, message: string) {
  busy.value = key
  try {
    await fn()
    note.value = message
  } catch (e: any) {
    note.value = e?.response?.data?.message ?? 'Action failed'
  } finally {
    busy.value = ''
    await refresh()
  }
}

const forceFraud = () => run('fraud',
  () => demo.setFraudThresholds(0.05, 0.15),
  'Fraud threshold lowered to 0.15 — the next transaction will halt in Fraud Review.')

const normalFraud = () => run('fraud',
  () => demo.setFraudThresholds(0.40, 0.80),
  'Fraud thresholds back to defaults (0.40 / 0.80).')

function applyRates(next: BankingRates, message: string) {
  rates.value = next
  formSeeded.value = true   // these are now the admin's chosen values — poll must not overwrite them
  return run('bank', () => demo.setBankingRates(next), message)
}

const forceRetries = () => applyRates(
  { debitTransientFailureRate: 1, creditTransientFailureRate: 1, creditPermanentFailureRate: 0, reversalPermanentFailureRate: 0, latencyMs: 150 },
  'Every debit and credit will now fail transiently first — watch the retry events with exponential backoff.')

const forceSaga = () => applyRates(
  { debitTransientFailureRate: 0, creditTransientFailureRate: 0, creditPermanentFailureRate: 1, reversalPermanentFailureRate: 0, latencyMs: 150 },
  'Every credit now fails permanently — the debit will be auto-reversed (saga compensation) and end as Failed.')

const forceDoubleFailure = () => applyRates(
  { debitTransientFailureRate: 0, creditTransientFailureRate: 0, creditPermanentFailureRate: 1, reversalPermanentFailureRate: 1, latencyMs: 150 },
  'Credit AND the reversal now fail — the double failure escalates to ManualReview so no loss is ever silent.')

const reliableBank = () => applyRates(
  { debitTransientFailureRate: 0, creditTransientFailureRate: 0, creditPermanentFailureRate: 0, reversalPermanentFailureRate: 0, latencyMs: 150 },
  'Banking rail is now perfectly reliable — transactions sail straight through.')

const saveRates = () => {
  formSeeded.value = true   // keep the applied values in the form; don't let the poll reset them
  return run('bank', () => demo.setBankingRates(rates.value), 'Banking rates updated.')
}

const toggleDb = () => status.value?.dbBroken
  ? run('db', demo.healDb, 'Database restored — in-flight store activities recover on their next retry.')
  : run('db', demo.breakDb, 'Database sealed off. Submit now: store activities fail and retry (~15s budget) — heal within that window and the workflow resumes.')

const toggleWorker = () => status.value?.workerRunning
  ? run('worker', demo.stopWorker, 'Worker stopped. Submit now — the workflow queues durably in Temporal and nothing is persisted yet.')
  : run('worker', demo.startWorker, 'Worker started — queued workflows resume exactly where they left off.')

const resetAll = () => {
  formSeeded.value = false   // reset re-arms seeding so the form snaps to the restored defaults
  return run('reset', demo.reset, 'Everything reset to configured defaults.')
}

let timer: number | undefined
onMounted(() => { refresh(); timer = window.setInterval(refresh, 4000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Demo controls</h1>
      <p>Inject failures on demand to demonstrate durability, retries, saga compensation and human-in-the-loop review.</p>
    </div>
    <button class="btn" :disabled="busy === 'reset' || unavailable" @click="resetAll">Reset all</button>
  </div>

  <div v-if="unavailable" class="panel card">
    <strong>Demo controls unavailable.</strong>
    <p style="margin-top:6px; color:var(--muted)">
      This panel only exists when the API runs in the Development environment, and requires the backend to be up.
    </p>
  </div>

  <template v-else>
    <p v-if="note" class="panel card" style="border-color:var(--accent); margin-bottom:16px">{{ note }}</p>

    <div class="demo-grid">
      <!-- Worker -->
      <div class="panel card">
        <div class="demo-head">
          <h3>Temporal worker</h3>
          <span class="pill" :class="status?.workerRunning ? 'ok' : 'bad'">
            {{ status?.workerRunning ? 'Running' : 'Stopped' }}
          </span>
        </div>
        <p class="demo-why">
          Stop the worker, then submit. The workflow is durably queued in Temporal and
          <em>nothing</em> is written to Postgres. Start it again and the backlog drains —
          no transaction is lost. This is the headline durability demo.
        </p>
        <button class="btn-primary" :disabled="busy === 'worker'" @click="toggleWorker">
          {{ status?.workerRunning ? 'Stop worker' : 'Start worker' }}
        </button>
      </div>

      <!-- Database -->
      <div class="panel card">
        <div class="demo-head">
          <h3>Database</h3>
          <span class="pill" :class="status?.dbBroken ? 'bad' : 'ok'">
            {{ status?.dbBroken ? 'Unreachable' : 'Healthy' }}
          </span>
        </div>
        <p class="demo-why">
          Seals off the <code>txguard</code> database (Temporal's own storage is untouched).
          Store activities fail and retry with backoff — about a <strong>15s</strong> budget,
          so heal within that window to show a clean recovery.
        </p>
        <button class="btn-primary" :disabled="busy === 'db'" @click="toggleDb">
          {{ status?.dbBroken ? 'Heal database' : 'Break database' }}
        </button>
      </div>

      <!-- Fraud -->
      <div class="panel card">
        <div class="demo-head">
          <h3>Fraud engine</h3>
          <span class="pill">high ≥ {{ status?.highRiskThreshold.toFixed(2) }}</span>
        </div>
        <p class="demo-why">
          Only <strong>High</strong> risk halts for review. At the default 0.80 the heuristic
          can barely reach it (ceiling ≈ 0.815), so drop the threshold to force it.
        </p>
        <div class="demo-actions">
          <button class="btn-primary" :disabled="busy === 'fraud'" @click="forceFraud">Force Fraud Review</button>
          <button class="btn" :disabled="busy === 'fraud'" @click="normalFraud">Restore defaults</button>
        </div>
      </div>

      <!-- Banking -->
      <div class="panel card banking-card">
        <div class="demo-head">
          <h3>Banking rail</h3>
          <span class="pill">latency {{ status?.latencyMs }}ms</span>
        </div>
        <p class="demo-why">
          Transient failures drive exponential-backoff retries. A permanent <em>credit</em>
          failure triggers saga compensation (debit auto-reversed). If the <em>reversal</em>
          also fails, it escalates to ManualReview — no loss is ever silent.
        </p>

        <div class="rate-grid">
          <label>
            <span>Debit transient</span>
            <input type="number" step="0.05" min="0" max="1"
                   v-model.number="rates.debitTransientFailureRate" />
          </label>
          <label>
            <span>Credit transient</span>
            <input type="number" step="0.05" min="0" max="1"
                   v-model.number="rates.creditTransientFailureRate" />
          </label>
          <label>
            <span>Credit permanent</span>
            <input type="number" step="0.05" min="0" max="1"
                   v-model.number="rates.creditPermanentFailureRate" />
          </label>
          <label>
            <span>Reversal permanent</span>
            <input type="number" step="0.05" min="0" max="1"
                   v-model.number="rates.reversalPermanentFailureRate" />
          </label>
          <label>
            <span>Latency (ms)</span>
            <input type="number" step="50" min="0" max="10000"
                   v-model.number="rates.latencyMs" />
          </label>
        </div>
        <p class="rate-hint">Rates are probabilities from 0 (never) to 1 (always).</p>

        <!-- Live server-side values, so the admin always sees what's actually applied
             even after editing the form or an auto-refresh. -->
        <p v-if="status" class="rate-active">
          <span class="rate-active-label">Active now:</span>
          debit {{ status.debitTransientFailureRate }} ·
          credit {{ status.creditTransientFailureRate }} ·
          credit-perm {{ status.creditPermanentFailureRate }} ·
          reversal-perm {{ status.reversalPermanentFailureRate }} ·
          latency {{ status.latencyMs }}ms
        </p>

        <div class="demo-actions">
          <button class="btn-primary" :disabled="busy === 'bank'" @click="saveRates">Apply rates</button>
          <button class="btn" :disabled="busy === 'bank'" @click="forceRetries">Force retries</button>
          <button class="btn" :disabled="busy === 'bank'" @click="forceSaga">Force saga reversal</button>
          <button class="btn" :disabled="busy === 'bank'" @click="forceDoubleFailure">Force double failure</button>
          <button class="btn" :disabled="busy === 'bank'" @click="reliableBank">Make reliable</button>
        </div>
      </div>
    </div>

    <div class="panel card" style="margin-top:16px">
      <h3 style="margin:0 0 8px">Suggested demo run</h3>
      <ol class="demo-steps">
        <li><strong>Stop worker</strong> → Submit a transaction → show nothing persisted → <strong>Start worker</strong> → it completes.</li>
        <li><strong>Force Fraud Review</strong> → Submit → approve it in Fraud Review → it resumes and completes.</li>
        <li><strong>Force saga reversal</strong> → Submit → open the transaction's audit trail to show <code>CreditFailed → ReversalInitiated → DebitReversed</code>.</li>
        <li><strong>Force double failure</strong> → Submit → the reversal fails too, ending in <code>ManualReview</code> — escalated to a human rather than silently lost.</li>
        <li><strong>Break database</strong> → Submit → heal within ~15s → the workflow recovers.</li>
        <li><strong>Reset all</strong> when you're done.</li>
      </ol>
    </div>
  </template>
</template>

<style scoped>
.demo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.demo-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.demo-head h3 { margin: 0; }
.demo-why { color: var(--muted); font-size: 13px; line-height: 1.55; margin: 0 0 14px; }
.demo-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pill { font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
.pill.ok { color: var(--green, #4ade80); border-color: currentColor; }
.pill.bad { color: var(--red, #f87171); border-color: currentColor; }
.demo-steps { margin: 0; padding-left: 20px; color: var(--muted); font-size: 13px; line-height: 1.9; }
.banking-card { grid-column: 1 / -1; }
.rate-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 6px; }
.rate-grid label { display: flex; flex-direction: column; gap: 5px; }
.rate-grid span { font-size: 12px; color: var(--muted); }
.rate-hint { font-size: 12px; color: var(--muted); margin: 0 0 8px; }
.rate-active {
  font-size: 12px; color: var(--muted); margin: 0 0 14px;
  padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.rate-active-label { color: var(--accent); font-weight: 600; margin-right: 4px; }
</style>
