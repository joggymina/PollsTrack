import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL missing")

const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 20000,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const POSITIONS_TO_SEED = [
  { position: "President", scope: "NATIONAL" },
  { position: "Governor", scope: "COUNTY" },
  { position: "Senator", scope: "COUNTY" },
  { position: "Woman Representative", scope: "COUNTY" },
  { position: "Member of Parliament", scope: "CONSTITUENCY" },
  { position: "Member of County Assembly", scope: "WARD" },
]

async function wakeDb() {
  for (let i = 1; i <= 4; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`
      console.log("✓ Database is awake")
      return
    } catch (e: any) {
      console.log(`  DB wake-up – attempt ${i} failed: ${e.message}`)
      if (i < 4) await new Promise((r) => setTimeout(r, 3000 * i))
    }
  }
  throw new Error("Could not connect to database")
}

async function main() {
  console.log("Seeding positions only...\n")
  await wakeDb()

  // Reuse existing active election, or create one
  let election = await prisma.election.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  })

  if (!election) {
    election = await prisma.election.create({
      data: {
        name: "2027 General Election - Test",
        type: "GENERAL",
        status: "ACTIVE",
        startDate: new Date("2027-08-01"),
        endDate: new Date("2027-08-15"),
      },
    })
    console.log(`✓ Election created: ${election.name}`)
  } else {
    console.log(`✓ Using election: ${election.name}`)
  }

  const existingRaces = await prisma.race.findMany({
    where: { electionId: election.id },
    select: { position: true },
  })
  const existingPositions = new Set(existingRaces.map((r) => r.position))

  for (const def of POSITIONS_TO_SEED) {
    if (existingPositions.has(def.position)) {
      console.log(`⏭  Skip (already exists): ${def.position}`)
      continue
    }

    const race = await prisma.race.create({
      data: {
        electionId: election.id,
        position: def.position,
        scope: def.scope,
      },
    })
    console.log(`✓ Race: ${race.position} (${race.scope})`)
  }

  const allRaces = await prisma.race.findMany({
    where: { electionId: election.id },
    orderBy: { position: "asc" },
  })

  console.log("\n========================================")
  console.log("POSITIONS READY")
  console.log("========================================")
  for (const r of allRaces) {
    console.log(`  ${r.position.padEnd(28)} ${r.scope}`)
  }
  console.log("========================================")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e.message || e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })