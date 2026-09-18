'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

type Props = {
  intervalSeconds?: number
}

export function AutoRefresh({ intervalSeconds = 20 }: Props) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const isRefreshing = useRef(false)

  // Set initial "Last updated" timestamp
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString())
  }, [])

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Schedule side-effects AFTER the current render/update finishes
          // so we never call router.refresh() inside a state updater
          if (!isRefreshing.current) {
            isRefreshing.current = true
            queueMicrotask(() => {
              router.refresh()
              setLastUpdated(new Date().toLocaleTimeString())
              isRefreshing.current = false
            })
          }
          return intervalSeconds
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdown)
  }, [router, intervalSeconds])

  const handleManualRefresh = () => {
    router.refresh()
    setLastUpdated(new Date().toLocaleTimeString())
    setSecondsLeft(intervalSeconds)
  }

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-gray-400">
      <span>
        Last updated: {lastUpdated || '—'} · Next refresh in {secondsLeft}s
      </span>
      <button
        onClick={handleManualRefresh}
        className="px-3 py-1 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors text-xs"
      >
        Refresh now
      </button>
    </div>
  )
}