'use client'

import type { SubmitResultsPayload } from './api'

const QUEUE_KEY = 'pollstrack_offline_queue'

export type QueuedSubmission = {
  id: string
  userId: string
  payload: SubmitResultsPayload
  stationName: string
  createdAt: string
  status: 'pending' | 'syncing' | 'failed'
  lastError?: string
}

export function getQueue(): QueuedSubmission[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueuedSubmission[]
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedSubmission[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Only items for the current logged-in agent */
export function getQueueForUser(userId: string): QueuedSubmission[] {
  return getQueue().filter((q) => q.userId === userId)
}

export function addToQueue(
  payload: SubmitResultsPayload,
  stationName: string,
  userId: string
): QueuedSubmission {
  const item: QueuedSubmission = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    payload,
    stationName,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }

  const queue = getQueue()
  queue.push(item)
  saveQueue(queue)
  return item
}

export function updateQueueItem(
  id: string,
  updates: Partial<QueuedSubmission>
) {
  const queue = getQueue()
  const index = queue.findIndex((q) => q.id === id)
  if (index === -1) return
  queue[index] = { ...queue[index], ...updates }
  saveQueue(queue)
}

export function removeFromQueue(id: string) {
  const queue = getQueue().filter((q) => q.id !== id)
  saveQueue(queue)
}

export function getPendingCount(userId?: string): number {
  const queue = userId ? getQueueForUser(userId) : getQueue()
  return queue.filter(
    (q) => q.status === 'pending' || q.status === 'failed'
  ).length
}

/** Clear everything (useful after testing) */
export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}