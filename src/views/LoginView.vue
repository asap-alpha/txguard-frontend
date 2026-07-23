<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../auth'
import { startRealtime } from '../realtime'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref(route.query.expired ? 'Your session expired — please sign in again.' : '')
const busy = ref(false)

// Demo credentials, so the capstone is easy to walk through.
const demoAccounts = [
  { username: 'admin', password: 'admin123', role: 'Admin — full access incl. demo panel' },
  { username: 'analyst', password: 'analyst123', role: 'Analyst — fraud decisions + read' },
  { username: 'partner', password: 'partner123', role: 'Integrator — submit + refund + read' },
]

function fill(u: string, p: string) { username.value = u; password.value = p }

async function submit() {
  error.value = ''; busy.value = true
  try {
    await login(username.value.trim(), password.value)
    await startRealtime()
    const dest = (route.query.redirect as string) || '/overview'
    router.replace(dest)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Sign-in failed'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="login-wrap">
    <div class="panel card login-card">
      <div class="brand" style="margin-bottom:18px">
        <span class="logo">Tx</span>
        <div>TxGuard<small>Durable Engine v1.0</small></div>
      </div>
      <h1 style="font-size:20px; margin:0 0 4px">Sign in</h1>
      <p class="dim" style="margin:0 0 18px">Authenticate to access the transaction engine.</p>

      <form @submit.prevent="submit">
        <div class="field"><label>Username</label><input v-model="username" autocomplete="username" autofocus /></div>
        <div class="field" style="margin-top:12px"><label>Password</label><input v-model="password" type="password" autocomplete="current-password" /></div>
        <p v-if="error" style="color:var(--red); margin:12px 0 0">{{ error }}</p>
        <button class="btn-primary" style="margin-top:16px; width:100%" :disabled="busy || !username || !password">
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <div class="demo-accounts">
        <div class="dim" style="font-size:12px; margin-bottom:8px">Demo accounts — click to fill</div>
        <button v-for="a in demoAccounts" :key="a.username" class="demo-account" type="button" @click="fill(a.username, a.password)">
          <span class="mono">{{ a.username }}</span>
          <span class="dim">{{ a.role }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.login-card { width: 100%; max-width: 380px; }
.demo-accounts { margin-top: 22px; border-top: 1px solid var(--border); padding-top: 16px; }
.demo-account { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 6px; background: transparent; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; }
.demo-account:hover { border-color: var(--accent); }
.demo-account .dim { font-size: 12px; }
</style>
