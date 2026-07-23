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
