import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initDevToolsGuard, initContextMenuGuard, initKeyGuard, injectDecoys } from './utils/protect.js'

// Initialise integrity utilities
initDevToolsGuard()
initContextMenuGuard()
initKeyGuard()
injectDecoys()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
