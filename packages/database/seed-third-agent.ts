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
  console.log("Seeding third Agent + Polling Station (for offline test)...\n")

  // 1. Get existing Test Ward
  const ward = await prisma.ward.findFirst({ where: { code: "TEST-WARD" } })
  if (!ward) {
    throw new Error("TEST-WARD not found. Run seed-agent-and-station.ts first.")
  }

  // 2. Third Polling Station
  let station = await prisma.pollingStation.findFirst({
    where: { code: "TEST-PS-003" },
  })
  if (!station) {
    station = await prisma.pollingStation.create({
      data: {
        code: "TEST-PS-003",
        name: "Test Community Hall Polling Station",
        wardId: ward.id,
        registeredVoters: 450,
      },
    })
    console.log(`✓ Polling Station: ${station.name}`)
  } else {
    console.log(`✓ Polling Station already exists: ${station.name}`)
  }

  // 3. Third Agent
  let agent = await prisma.user.findFirst({
    where: { phone: "254700000003" },
  })
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        phone: "254700000003",
        name: "Test Agent 3",
        role: "AGENT",
        isActive: true,
      },
    })
    console.log(`✓ Agent: ${agent.name} (${agent.phone})`)
  } else {
    console.log(`✓ Agent already exists: ${agent.name}`)
  }

  // 4. Assign agent to station
  const existing = await prisma.agentAssignment.findFirst({
    where: { userId: agent.id, pollingStationId: station.id },
  })
  if (!existing) {
    await prisma.agentAssignment.create({
      data: {
        userId: agent.id,
        pollingStationId: station.id,
      },
    })
    console.log(`✓ Agent assigned to station`)
  } else {
    console.log(`✓ Agent already assigned`)
  }

  console.log("\n========================================")
  console.log("THIRD AGENT READY (OFFLINE TEST)")
  console.log("========================================")
  console.log(`Phone to login     : 254700000003`)
  console.log(`Agent name         : ${agent.name}`)
  console.log(`Polling Station    : ${station.name} (${station.code})`)
  console.log(`Station ID         : ${station.id}`)
  console.log("========================================\n")
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