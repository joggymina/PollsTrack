'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Service worker registered', reg.scope)
      })
      .catch((err) => {
        console.warn('Service worker registration failed', err)
      })
  }, [])

  return null
}