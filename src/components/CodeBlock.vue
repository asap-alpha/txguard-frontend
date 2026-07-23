<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ code: string; label?: string }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* clipboard unavailable */ }
}
</script>

<template>
  <div class="code">
    <button class="copy-btn" type="button" @click="copy" :title="copied ? 'Copied' : 'Copy'">
      {{ copied ? 'Copied ✓' : 'Copy' }}
    </button>
    <pre>{{ code }}</pre>
  </div>
</template>

<style scoped>
.code { position: relative; }
.copy-btn {
  position: absolute; top: 8px; right: 8px; z-index: 1;
  font-size: 11px; padding: 4px 9px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--panel, var(--bg));
  color: var(--muted); cursor: pointer;
}
.copy-btn:hover { border-color: var(--accent); color: var(--accent); }
pre {
  background: color-mix(in srgb, var(--muted) 12%, transparent);
  border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 14px; padding-right: 66px; overflow-x: auto;
  font-size: 12.5px; line-height: 1.5; white-space: pre; margin: 0;
}
</style>
