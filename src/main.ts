import { createApp } from 'vue'
import './theme' // sets data-theme on <html> before first paint
import './style.css'
import App from './App.vue'
import router from './router'
import { startRealtime } from './realtime'

createApp(App).use(router).mount('#app')
startRealtime()
