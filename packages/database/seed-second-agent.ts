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
  console.log("Seeding second Agent + Polling Station...\n")

  // 1. Get existing Test Ward (or create under Nairobi)
  let ward = await prisma.ward.findFirst({ where: { code: "TEST-WARD" } })
  if (!ward) {
    throw new Error("TEST-WARD not found. Run seed-agent-and-station.ts first.")
  }

  // 2. Second Polling Station
  let station = await prisma.pollingStation.findFirst({
    where: { code: "TEST-PS-002" },
  })
  if (!station) {
    station = await prisma.pollingStation.create({
      data: {
        code: "TEST-PS-002",
        name: "Test Secondary School Polling Station",
        wardId: ward.id,
        registeredVoters: 680,
      },
    })
    console.log(`✓ Polling Station: ${station.name}`)
  } else {
    console.log(`✓ Polling Station already exists: ${station.name}`)
  }

  // 3. Second Agent
  let agent = await prisma.user.findFirst({
    where: { phone: "254700000002" },
  })
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        phone: "254700000002",
        name: "Test Agent 2",
        role: "AGENT",
        isActive: true,
      },
    })
    console.log(`✓ Agent: ${agent.name} (${agent.phone})`)
  } else {
    console.log(`✓ Agent already exists: ${agent.name}`)
  }

  // 4. Assign agent to the new station
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
  console.log("SECOND AGENT READY")
  console.log("========================================")
  console.log(`Phone to login     : 254700000002`)
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