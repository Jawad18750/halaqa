import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { enforceAppVersionReload } from './lib/appVersion.js'
import './index.css'
import App from './App.jsx'

enforceAppVersionReload()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
