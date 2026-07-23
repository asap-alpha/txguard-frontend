<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type SubmitRequest } from '../api'
import { PROVIDERS, accountLabel, accountNumberError, normalizeAccountNumber } from '../account'

const router = useRouter()
const providers = PROVIDERS.map(p => p.name)
const error = ref('')
const busy = ref(false)

const form = ref({
  senderName: 'Ama Owusu', senderNumber: '0244123456', senderProvider: 'MTN MoMo',
  recipientName: 'Kofi Mensah', recipientNumber: '0201987654', recipientProvider: 'GCB Bank',
  amountMajor: 125.0, reference: '', type: 'Transfer' as 'Transfer' | 'BillPayment',
})

const touched = ref({ senderNumber: false, recipientNumber: false })

const senderNumberError = computed(() => accountNumberError(form.value.senderNumber, form.value.senderProvider))
const recipientNumberError = computed(() => accountNumberError(form.value.recipientNumber, form.value.recipientProvider))
const canSubmit = computed(() => !senderNumberError.value && !recipientNumberError.value)

const senderLabel = computed(() => accountLabel(form.value.senderProvider))
const recipientLabel = computed(() => accountLabel(form.value.recipientProvider))

async function submit() {
  touched.value.senderNumber = true; touched.value.recipientNumber = true
  if (!canSubmit.value) return

  // Send the normalised form so account ids stay stable regardless of how the
  // operator typed the number (+233…, spaces, dashes).
  const senderNumber = normalizeAccountNumber(form.value.senderNumber, form.value.senderProvider)!
  const recipientNumber = normalizeAccountNumber(form.value.recipientNumber, form.value.recipientProvider)!

  error.value = ''; busy.value = true
  try {
    const body: SubmitRequest = {
      sender: { accountId: 'acc-' + senderNumber, name: form.value.senderName, accountNumber: senderNumber, provider: form.value.senderProvider },
      recipient: { accountId: 'acc-' + recipientNumber, name: form.value.recipientName, accountNumber: recipientNumber, provider: form.value.recipientProvider },
      amountMinor: Math.round(form.value.amountMajor * 100),
      currency: 'GHS', type: form.value.type, reference: form.value.reference || undefined,
    }
    const res = await api.submit(body)
    router.push(`/transactions/${res.transactionId}`)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Submission failed'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="page-head"><div><h1>Submit transaction</h1><p>Starts a durable Temporal workflow — fraud scoring runs before any funds move.</p></div></div>

  <div class="panel card" style="max-width:640px">
    <div class="form-grid">
      <div class="field"><label>Sender name</label><input v-model="form.senderName" /></div>
      <div class="field">
        <label>Sender {{ senderLabel }}</label>
        <input v-model="form.senderNumber" inputmode="numeric" placeholder="0244123456"
               :class="{ invalid: touched.senderNumber && senderNumberError }"
               @blur="touched.senderNumber = true" />
        <p v-if="touched.senderNumber && senderNumberError" class="field-error">{{ senderNumberError }}</p>
      </div>
      <div class="field"><label>Sender provider</label><select v-model="form.senderProvider"><option v-for="p in providers" :key="p">{{ p }}</option></select></div>
      <div class="field"><label>Type</label><select v-model="form.type"><option>Transfer</option><option>BillPayment</option></select></div>
      <div class="field"><label>Recipient name</label><input v-model="form.recipientName" /></div>
      <div class="field">
        <label>Recipient {{ recipientLabel }}</label>
        <input v-model="form.recipientNumber" inputmode="numeric" placeholder="0201987654"
               :class="{ invalid: touched.recipientNumber && recipientNumberError }"
               @blur="touched.recipientNumber = true" />
        <p v-if="touched.recipientNumber && recipientNumberError" class="field-error">{{ recipientNumberError }}</p>
      </div>
      <div class="field"><label>Recipient provider</label><select v-model="form.recipientProvider"><option v-for="p in providers" :key="p">{{ p }}</option></select></div>
      <div class="field"><label>Amount (GH₵)</label><input type="number" step="0.01" min="0.01" v-model.number="form.amountMajor" /></div>
      <div class="field" style="grid-column:1/3"><label>Reference (optional)</label><input v-model="form.reference" placeholder="e.g. rent, school fees" /></div>
    </div>
    <p v-if="error" style="color:var(--red); margin-top:12px">{{ error }}</p>
    <div style="margin-top:16px; display:flex; gap:10px">
      <button class="btn-primary" :disabled="busy || !canSubmit" @click="submit">{{ busy ? 'Submitting…' : 'Submit transaction' }}</button>
      <RouterLink class="btn" to="/transactions">Cancel</RouterLink>
    </div>
  </div>
</template>
