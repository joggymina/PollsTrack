'use client'

import { getToken, getUser } from './auth'
import { submitResults } from './api'
import {
  getQueueForUser,
  updateQueueItem,
  removeFromQueue,
} from './offline-queue'

export async function syncOfflineQueue(): Promise<{
  synced: number
  failed: number
}> {
  const token = getToken()
  const user = getUser()
  if (!token || !user || !navigator.onLine) {
    return { synced: 0, failed: 0 }
  }

  const queue = getQueueForUser(user.id).filter(
    (q) => q.status === 'pending' || q.status === 'failed'
  )

  let synced = 0
  let failed = 0

  for (const item of queue) {
    updateQueueItem(item.id, { status: 'syncing' })

    try {
      await submitResults(token, item.payload)
      removeFromQueue(item.id)
      synced++
    } catch (err: any) {
      const msg = (err.message || 'Sync failed').toString()

      // Already submitted → treat as success and remove
      if (
        msg.includes('already been submitted') ||
        msg.includes('409') ||
        msg.includes('Conflict')
      ) {
        removeFromQueue(item.id)
        synced++
        continue
      }

      // Not allowed / wrong agent → remove so it doesn't block forever
      if (
        msg.includes('not assigned') ||
        msg.includes('403') ||
        msg.includes('Forbidden') ||
        msg.includes('Unauthorized')
      ) {
        removeFromQueue(item.id)
        failed++
        continue
      }

      updateQueueItem(item.id, {
        status: 'failed',
        lastError: msg,
      })
      failed++
    }
  }

  return { synced, failed }
}