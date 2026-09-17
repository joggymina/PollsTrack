import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL missing")

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding sample Election, Race & Candidates...")

  // 1. Create Election
  const election = await prisma.election.create({
    data: {
      name: "2027 Party Primaries - Test",
      type: "PRIMARY",
      status: "ACTIVE",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-15"),
    },
  })
  console.log(`✓ Election created: ${election.name}`)

  // 2. Create a Race (e.g. Member of County Assembly - Ward level for testing)
  // We'll attach it to Mathare constituency for simplicity
  const mathare = await prisma.constituency.findFirst({
    where: { code: "291" },
  })

  if (!mathare) {
    throw new Error("Mathare constituency not found. Run previous seeds first.")
  }

  const race = await prisma.race.create({
    data: {
      electionId: election.id,
      position: "Member of County Assembly",
      scope: "WARD",
      constituencyId: mathare.id,
    },
  })
  console.log(`✓ Race created: ${race.position}`)

  // 3. Create sample Candidates
  const candidates = [
    { name: "John Kamau", code: "C001", party: "Party A" },
    { name: "Mary Wanjiku", code: "C002", party: "Party B" },
    { name: "Peter Ochieng", code: "C003", party: "Independent" },
  ]

  for (const c of candidates) {
    await prisma.candidate.create({
      data: {
        raceId: race.id,
        name: c.name,
        code: c.code,
        party: c.party,
      },
    })
    console.log(`  ✓ Candidate: ${c.name}`)
  }

  console.log("\nDone! Sample election data ready.")
  console.log(`Election ID: ${election.id}`)
  console.log(`Race ID: ${race.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })