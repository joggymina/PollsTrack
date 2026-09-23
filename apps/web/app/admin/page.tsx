'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getToken, getUser, isLoggedIn, clearAuth } from '@/lib/auth'
import { getAdminAgents } from '@/lib/api'

export default function AdminHomePage() {
  const router = useRouter()
  const [agentCount, setAgentCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }

    const user = getUser()
    if (user?.role !== 'SUPER_ADMIN') {
      router.replace('/agent')
      return
    }

    const token = getToken()!
    getAdminAgents(token)
      .then((list) => setAgentCount(list.length))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading…</div>
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage agents & stations</p>
        </div>
        <button
          onClick={() => {
            clearAuth()
            router.replace('/login')
          }}
          className="text-sm text-gray-500 hover:text-red-600"
        >
          Logout
        </button>
      </div>

      <div className="grid gap-3">
        <Link
          href="/admin/agents"
          className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-300 shadow-sm"
        >
          <p className="font-semibold text-gray-900">Agents</p>
          <p className="text-sm text-gray-500 mt-1">
            {agentCount} registered · Create & assign stations
          </p>
        </Link>

        <Link
          href="/agent"
          className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-300 shadow-sm"
        >
          <p className="font-semibold text-gray-900">Agent portal</p>
          <p className="text-sm text-gray-500 mt-1">Submit results as an agent</p>
        </Link>

        <Link
          href="/"
          className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-blue-300 shadow-sm"
        >
          <p className="font-semibold text-gray-900">Public dashboard</p>
          <p className="text-sm text-gray-500 mt-1">Live election results</p>
        </Link>
      </div>
    </div>
  )
}