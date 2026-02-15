import App from './App.svelte'
import './styles.css'

const app = new App({
  target: document.getElementById('app'),
})

// Only register service worker in production builds
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister()
    })
  }).then(() => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service Worker registration failed:', err)
    })
  })
} else if ('serviceWorker' in navigator && import.meta.env.DEV) {
  // Unregister any service workers in dev mode
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister()
    })
  })
}

export default app
