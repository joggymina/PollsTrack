import type { CandidateTotal } from '@/lib/api'

type Props = {
  candidates: CandidateTotal[]
}

export function CandidateRanking({ candidates }: Props) {
  const maxVotes = Math.max(...candidates.map((c) => c.totalVotes), 1)

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Candidate Ranking</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {candidates.map((c, index) => {
          const percentage = ((c.totalVotes / maxVotes) * 100).toFixed(1)
          return (
            <div key={c.candidateId} className="px-6 py-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <p className="font-medium text-gray-900 truncate">
                    {c.name}
                    {c.party && (
                      <span className="ml-2 text-sm text-gray-500">({c.party})</span>
                    )}
                  </p>
                  <p className="font-semibold text-gray-900 ml-2">
                    {c.totalVotes.toLocaleString()}
                  </p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
        {candidates.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No results submitted yet
          </div>
        )}
      </div>
    </div>
  )
}