// Base URL of the TxGuard API.
//
// Empty in local development, so requests stay relative (`/api/v1/...`, `/hubs/...`)
// and are handled by Vite's dev proxy → localhost:5080 (see vite.config.ts).
//
// In production (Vercel), set VITE_API_BASE to the deployed API origin, e.g.
//   VITE_API_BASE=https://txguard.duckdns.org
// so the browser calls the backend directly. This is required — SignalR uses
// WebSockets, which a Vercel rewrite/proxy cannot forward.
//
// Trailing slash is trimmed so `${API_BASE}/api/v1` never doubles up.
export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

// Where the sidebar "Temporal UI" link points. The Temporal UI is never exposed
// publicly (it has no auth), so it is reached over an SSH tunnel — the documented
// command forwards it to localhost:8233, which is the default here. For a fully-local
// dev stack the UI is on :8088; set VITE_TEMPORAL_UI_URL to override.
export const TEMPORAL_UI_URL =
  import.meta.env.VITE_TEMPORAL_UI_URL ?? 'http://localhost:8233'

