type Props = {
  stationsReported: number
  totalVoted: number
  totalRejected: number
}

export function StatsCards({ stationsReported, totalVoted, totalRejected }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <p className="text-sm text-gray-500">Stations Reported</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{stationsReported}</p>
      </div>
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <p className="text-sm text-gray-500">Total Votes Cast</p>
        <p className="text-3xl font-bold text-green-600 mt-1">
          {totalVoted.toLocaleString()}
        </p>
      </div>
      <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
        <p className="text-sm text-gray-500">Rejected Ballots</p>
        <p className="text-3xl font-bold text-red-500 mt-1">
          {totalRejected.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

