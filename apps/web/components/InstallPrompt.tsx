'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as any).standalone === true

    if (isStandalone) {
      setVisible(false)
      return
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    function onAppInstalled() {
      setDeferredPrompt(null)
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setVisible(false)
    }

    setDeferredPrompt(null)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
      <div className="bg-blue-600 text-white rounded-2xl shadow-lg p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm sm:text-base">Install PollsTrack</p>
          <p className="text-blue-100 text-xs sm:text-sm">
            Add to your home screen for faster access & offline use
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="px-3 py-2 text-sm text-blue-100 hover:text-white"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="px-4 py-2 bg-white text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}