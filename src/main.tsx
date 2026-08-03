import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './pwa'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.error('Tawazon service worker registration failed:', error))
  })
}
