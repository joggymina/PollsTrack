import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL missing")

const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 45000, // 45 seconds
  idleTimeoutMillis: 30000,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 6): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      console.log(`  ${label} – attempt ${attempt} failed: ${err.message || err.code || err}`)
      if (attempt === maxAttempts) throw err
      console.log(`  Retrying in 4 seconds...`)
      await sleep(4000)
    }
  }
  throw new Error("Unreachable")
}

async function main() {
  console.log("Seeding sample Agent + Polling Station...\n")

  // Wake-up ping with retries
  console.log("Waking database...")
  await withRetry(() => prisma.$queryRaw`SELECT 1`, "DB wake-up")
  console.log("✓ Database is awake\n")

  // 1. Get Nairobi county
  const nairobi = await withRetry(
    () => prisma.county.findFirst({ where: { code: "047" } }),
    "Find Nairobi"
  )
  if (!nairobi) throw new Error("Nairobi county not found. Seed counties first.")

  // 2. Constituency
  let constituency = await prisma.constituency.findFirst({ where: { code: "TEST-CONST" } })
  if (!constituency) {
    constituency = await prisma.constituency.create({
      data: {
        code: "TEST-CONST",
        name: "Test Constituency",
        countyId: nairobi.id,
      },
    })
    console.log(`✓ Constituency: ${constituency.name}`)
  } else {
    console.log(`✓ Constituency already exists: ${constituency.name}`)
  }

  // 3. Ward
  let ward = await prisma.ward.findFirst({ where: { code: "TEST-WARD" } })
  if (!ward) {
    ward = await prisma.ward.create({
      data: {
        code: "TEST-WARD",
        name: "Test Ward",
        constituencyId: constituency.id,
      },
    })
    console.log(`✓ Ward: ${ward.name}`)
  } else {
    console.log(`✓ Ward already exists: ${ward.name}`)
  }

  // 4. Polling Station
  let station = await prisma.pollingStation.findFirst({ where: { code: "TEST-PS-001" } })
  if (!station) {
    station = await prisma.pollingStation.create({
      data: {
        code: "TEST-PS-001",
        name: "Test Primary School Polling Station",
        wardId: ward.id,
        registeredVoters: 520,
      },
    })
    console.log(`✓ Polling Station: ${station.name}`)
  } else {
    console.log(`✓ Polling Station already exists: ${station.name}`)
  }

  // 5. Agent user
  let agent = await prisma.user.findFirst({ where: { phone: "254700000001" } })
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        phone: "254700000001",
        name: "Test Agent",
        role: "AGENT",
        isActive: true,
      },
    })
    console.log(`✓ Agent: ${agent.name} (${agent.phone})`)
  } else {
    console.log(`✓ Agent already exists: ${agent.name}`)
  }

  // 6. Assign agent to station
  const existingAssignment = await prisma.agentAssignment.findFirst({
    where: { userId: agent.id, pollingStationId: station.id },
  })
  if (!existingAssignment) {
    await prisma.agentAssignment.create({
      data: { userId: agent.id, pollingStationId: station.id },
    })
    console.log(`✓ Agent assigned to station`)
  } else {
    console.log(`✓ Agent already assigned to station`)
  }

  // 7. Race + candidates
  const race = await prisma.race.findFirst({
    where: { position: "Member of County Assembly" },
    include: { candidates: true },
  })

  if (!race || race.candidates.length === 0) {
    console.log("\n⚠ No race/candidates found. Run seed-election.ts first.")
  } else {
    console.log(`\n✓ Race found: ${race.position}`)
    console.log(`  Candidates:`)
    for (const c of race.candidates) {
      console.log(`    - ${c.name} (${c.id})`)
    }
  }

  console.log("\n========================================")
  console.log("READY FOR RESULT SUBMISSION TEST")
  console.log("========================================")
  console.log(`Polling Station ID     : ${station.id}`)
  console.log(`Agent (submittedBy) ID : ${agent.id}`)
  if (race) {
    console.log(`Race ID                : ${race.id}`)
    console.log(`Candidate IDs:`)
    for (const c of race.candidates) {
      console.log(`  ${c.name}: ${c.id}`)
    }
  }
  console.log("========================================\n")
}

main()
  .catch((e) => {
    console.error("\nSeed failed:", e.message || e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })