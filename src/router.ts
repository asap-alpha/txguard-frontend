import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated, hasRole, type Role } from './auth'

const routes = [
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: () => import('./views/OverviewView.vue') },
  { path: '/transactions', component: () => import('./views/TransactionsView.vue') },
  { path: '/transactions/:id', component: () => import('./views/TransactionDetailView.vue') },
  { path: '/refunds', component: () => import('./views/RefundsView.vue') },
  { path: '/submit', component: () => import('./views/SubmitView.vue'), meta: { roles: ['Integrator', 'Admin'] as Role[] } },
  { path: '/fraud-review', component: () => import('./views/FraudReviewView.vue'), meta: { roles: ['Analyst', 'Admin'] as Role[] } },
  { path: '/audit', component: () => import('./views/AuditLogView.vue') },
  { path: '/demo', component: () => import('./views/DemoView.vue'), meta: { roles: ['Admin'] as Role[] } },
  { path: '/api-keys', component: () => import('./views/ApiKeysView.vue'), meta: { roles: ['Admin'] as Role[] } },
  { path: '/integration', component: () => import('./views/IntegrationView.vue'), meta: { roles: ['Admin'] as Role[] } },
]

const router = createRouter({ history: createWebHistory(), routes })

// Auth guard: unauthenticated users go to /login; role-restricted routes fall back
// to the overview when the signed-in role isn't permitted.
router.beforeEach(to => {
  if (to.meta.public) return true
  if (!isAuthenticated.value) return { path: '/login', query: { redirect: to.fullPath } }
  const roles = to.meta.roles as Role[] | undefined
  if (roles && !hasRole(...roles)) return { path: '/overview' }
  return true
})

export default router
