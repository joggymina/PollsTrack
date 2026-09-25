import 'dotenv/config'
import { prisma } from './src/client'

async function main() {
  console.log('Clearing ResultVote then Candidate...')

  const votes = await prisma.resultVote.deleteMany({})
  console.log(`Deleted ResultVote: ${votes.count}`)

  const candidates = await prisma.candidate.deleteMany({})
  console.log(`Deleted Candidate: ${candidates.count}`)

  // Optional: also clear station results if you want a fully clean slate
  // const results = await prisma.stationResult.deleteMany({})
  // console.log(`Deleted StationResult: ${results.count}`)

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())