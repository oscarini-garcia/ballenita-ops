/**
 * Arranque de la PWA: monta React y enciende lo que tiene que estar antes del
 * primer píxel.
 *
 * El orden no es casual. `applySkin()` va antes del render para que el tema
 * guardado no llegue un fotograma tarde —eso se vería como un parpadeo blanco
 * en un tema oscuro—, y `initNative()` después, porque las capacidades de la
 * cáscara de iOS (OTA, push, háptica) no las necesita el primer pintado y en el
 * navegador son no-op.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import './skins.css'
import { applySkin } from './lib/skins.js'
import { initNative } from './lib/native.js'

applySkin() // fija el tema guardado antes del primer render
initNative() // capacidades nativas (OTA/push/háptica); no-op en web

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
