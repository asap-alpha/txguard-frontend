<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminKeys, relativeTime, type ApiKey, type CreatedApiKey } from '../api'

const keys = ref<ApiKey[]>([])
const loading = ref(true)
const newName = ref('')
const busy = ref(false)
const error = ref('')
const justCreated = ref<CreatedApiKey | null>(null)   // shown once, with the secret
const copied = ref(false)

async function load() {
  loading.value = true
  try { keys.value = await adminKeys.list() } finally { loading.value = false }
}

async function create() {
  if (!newName.value.trim()) return
  busy.value = true; error.value = ''; justCreated.value = null
  try {
    justCreated.value = await adminKeys.create(newName.value.trim())
    newName.value = ''
    await load()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Could not create key'
  } finally { busy.value = false }
}

async function revoke(k: ApiKey) {
  if (!confirm(`Revoke the key for "${k.name}"? Any integrator using it will immediately lose access.`)) return
  busy.value = true
  try { await adminKeys.revoke(k.id); await load() } finally { busy.value = false }
}

async function copyKey() {
  if (!justCreated.value) return
  try { await navigator.clipboard.writeText(justCreated.value.fullKey); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch { /* ignore */ }
}

onMounted(load)
</script>

<template>
  <div class="page-head">
    <div>
      <h1>API keys</h1>
      <p>Issue and revoke keys for machine/partner integrators. A key authenticates as the <strong>Integrator</strong> role via the <code>X-Api-Key</code> header. See the <RouterLink to="/integration">Integration Guide</RouterLink> for the full API.</p>
    </div>
  </div>

  <!-- Create -->
  <div class="panel card" style="margin-bottom:16px">
    <div class="label" style="margin-bottom:10px">Generate a new key</div>
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">
      <input v-model="newName" placeholder="Partner name, e.g. Acme Payments" style="flex:1; min-width:240px"
             @keyup.enter="create" />
      <button class="btn-primary" :disabled="busy || !newName.trim()" @click="create">Generate key</button>
    </div>
    <p v-if="error" style="color:var(--red); margin-top:10px">{{ error }}</p>

    <!-- One-time secret reveal -->
    <div v-if="justCreated" class="reveal">
      <div class="reveal-head">🔑 {{ justCreated.message }}</div>
      <div class="reveal-key">
        <code class="mono">{{ justCreated.fullKey }}</code>
        <button class="btn" @click="copyKey">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
      </div>
      <div class="dim" style="font-size:12px; margin-top:8px">
        Send it as <code>X-Api-Key: {{ justCreated.fullKey.slice(0, 17) }}…</code> on requests to <code>/api/v1/*</code>.
      </div>
    </div>
  </div>

  <!-- List -->
  <div class="panel card">
    <div v-if="loading" class="dim">Loading…</div>
    <div v-else-if="!keys.length" class="dim">No API keys yet. Generate one above.</div>
    <table v-else class="tbl">
      <thead>
        <tr><th>Name</th><th>Key</th><th>Status</th><th>Created</th><th>Last used</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="k in keys" :key="k.id">
          <td>{{ k.name }}</td>
          <td class="mono dim">{{ k.prefix }}…</td>
          <td>
            <span class="badge" :class="k.active ? 'ok' : 'bad'">{{ k.active ? 'Active' : 'Revoked' }}</span>
          </td>
          <td class="dim">{{ relativeTime(k.createdAtUtc) }}<br><span style="font-size:11px">by {{ k.createdBy }}</span></td>
          <td class="dim">{{ k.lastUsedAtUtc ? relativeTime(k.lastUsedAtUtc) : 'never' }}</td>
          <td style="text-align:right">
            <button v-if="k.active" class="btn-reject" :disabled="busy" @click="revoke(k)">Revoke</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.reveal { margin-top: 14px; padding: 14px; border: 1px solid var(--accent); border-radius: 10px; background: color-mix(in srgb, var(--accent) 8%, transparent); }
.reveal-head { font-weight: 600; margin-bottom: 10px; }
.reveal-key { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.reveal-key code { flex: 1; min-width: 220px; word-break: break-all; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 6px 10px; border-bottom: 1px solid var(--border); }
.tbl td { padding: 12px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
.badge.ok { color: var(--green, #4ade80); }
.badge.bad { color: var(--red, #f87171); }
</style>
