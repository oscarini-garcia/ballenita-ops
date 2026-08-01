import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import './skins.css'
import { applySkin } from './lib/skins.js'
import { applyTamano } from './lib/tamano.js'
import { initNative } from './lib/native.js'

applySkin()   // fija el tema guardado antes del primer render
applyTamano() // y el tamaño del texto, por lo mismo: si no, la app parpadea de talla
initNative() // capacidades nativas (OTA/push/háptica); no-op en web

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
