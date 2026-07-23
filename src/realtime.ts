import * as signalR from '@microsoft/signalr'
import { ref } from 'vue'
import { token } from './auth'

/**
 * Shared SignalR connection to the TxGuard hub. Components subscribe to
 * `onTransactionChanged` to refresh their data live as workflows progress.
 * The hub requires auth; the token rides as ?access_token= (WebSockets can't
 * send an Authorization header).
 */
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/transactions', { accessTokenFactory: () => token() ?? '' })
  .withAutomaticReconnect()
  .build()

export const connected = ref(false)
const listeners = new Set<(transactionId: string) => void>()

connection.on('transactionChanged', (transactionId: string) => {
  listeners.forEach(fn => fn(transactionId))
})
connection.onreconnected(() => (connected.value = true))
connection.onclose(() => (connected.value = false))

export async function startRealtime() {
  if (!token()) return   // hub requires auth; skip until signed in
  if (connection.state === signalR.HubConnectionState.Disconnected) {
    try { await connection.start(); connected.value = true } catch { connected.value = false }
  }
}

export async function stopRealtime() {
  if (connection.state !== signalR.HubConnectionState.Disconnected) {
    try { await connection.stop() } catch { /* ignore */ }
  }
  connected.value = false
}

export function onTransactionChanged(fn: (transactionId: string) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
