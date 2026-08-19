import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Service worker : enregistré automatiquement par vite-plugin-pwa
// (registerType 'autoUpdate') — l'enregistrement manuel de /sw.js
// créait un double enregistrement avec un chemin potentiellement faux.

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
