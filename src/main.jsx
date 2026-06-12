import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initContextMenuGuard, initKeyGuard, injectDecoys } from './utils/protect.js'

// Initialise integrity utilities
// (devtools blur guard removed — it false-triggered on browser zoom and
// docked side panels, blurring the site for legitimate customers)
initContextMenuGuard()
initKeyGuard()
injectDecoys()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
