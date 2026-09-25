'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Race = {
  id: string
  position: string
}

export function RaceSelector({
  races,
  currentRaceId,
}: {
  races: Race[]
  currentRaceId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (races.length <= 1) {
    return (
      <p className="text-gray-500 mt-1">
        {races[0]?.position || 'Election'} · Live results
      </p>
    )
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raceId = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    params.set('raceId', raceId)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor="race-select" className="text-sm text-gray-500">
        Race:
      </label>
      <select
        id="race-select"
        value={currentRaceId}
        onChange={onChange}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {races.map((race) => (
          <option key={race.id} value={race.id}>
            {race.position}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-400">· Live results</span>
    </div>
  )
}