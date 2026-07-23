<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './api'
import { connected, onTransactionChanged, stopRealtime } from './realtime'
import { session, isAuthenticated, can, logout as doLogout } from './auth'
import { resolvedTheme, toggleTheme } from './theme'
import { TEMPORAL_UI_URL } from './config'

const route = useRoute()
const router = useRouter()
const fraudQueue = ref(0)

async function refresh() {
  if (!isAuthenticated.value) return
  try { fraudQueue.value = (await api.overview()).fraudQueue } catch { /* API may be starting */ }
}
async function logout() {
  await stopRealtime()
  doLogout()
  router.replace('/login')
}

let off: (() => void) | undefined
let timer: number | undefined
onMounted(() => { refresh(); off = onTransactionChanged(refresh); timer = window.setInterval(refresh, 5000) })
onUnmounted(() => { off?.(); if (timer) clearInterval(timer) })
</script>

<template>
  <!-- Login (and any public route) renders bare, without the app shell -->
  <RouterView v-if="route.meta.public || !isAuthenticated" />

  <div v-else class="app">
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">Tx</span>
        <div>TxGuard<small>Durable Engine v1.0</small></div>
      </div>

      <nav class="nav">
        <div class="nav-group">
          <h4>Operations</h4>
          <RouterLink to="/overview"><span class="ico">▚</span> Overview</RouterLink>
          <RouterLink to="/transactions"><span class="ico">≡</span> Transactions</RouterLink>
          <RouterLink v-if="can.decideFraud()" to="/fraud-review">
            <span class="ico">⚑</span> Fraud Review
            <span v-if="fraudQueue > 0" class="badge-count">{{ fraudQueue }}</span>
          </RouterLink>
          <RouterLink v-if="can.submit()" to="/submit"><span class="ico">＋</span> Submit</RouterLink>
        </div>
        <div class="nav-group">
          <h4>Intelligence</h4>
          <RouterLink to="/audit"><span class="ico">◷</span> Audit Log</RouterLink>
        </div>
        <div class="nav-group">
          <h4>System</h4>
          <RouterLink v-if="can.demo()" to="/api-keys"><span class="ico">🔑</span> API Keys</RouterLink>
          <RouterLink v-if="can.demo()" to="/integration"><span class="ico">◧</span> Integration Guide</RouterLink>
          <RouterLink v-if="can.demo()" to="/demo"><span class="ico">⚡</span> Demo Controls</RouterLink>
          <a :href="TEMPORAL_UI_URL" target="_blank"><span class="ico">⚙</span> Temporal UI ↗</a>
        </div>
      </nav>

      <div class="user-box" v-if="session">
        <div class="user-meta">
          <div class="user-name">{{ session.displayName }}</div>
          <div class="user-role">{{ session.role }}</div>
        </div>
        <button class="btn icon-btn" @click="toggleTheme"
                :title="resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
                :aria-label="resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
          {{ resolvedTheme === 'dark' ? '☀' : '☾' }}
        </button>
        <button class="btn icon-btn" @click="logout" title="Sign out" aria-label="Sign out">⏻</button>
      </div>
    </aside>

    <main class="main">
      <RouterView />
      <div class="live" :class="{ on: connected }" style="margin-top:22px">
        <span class="dot"></span>{{ connected ? 'Live — connected to TxGuard' : 'Reconnecting…' }}
      </div>
    </main>
  </div>
</template>

<style scoped>
.nav a.router-link-active { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); }
.user-box { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 12px; border-top: 1px solid var(--border); }
.user-meta { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-role { font-size: 11px; color: var(--muted); }
.icon-btn { padding: 6px 10px; }
</style>
