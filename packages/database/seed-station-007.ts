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
  const ward = await prisma.ward.findFirst({ where: { code: "TEST-WARD" } })
  if (!ward) throw new Error("TEST-WARD not found")

  let station = await prisma.pollingStation.findFirst({
    where: { code: "TEST-PS-007" },
  })

  if (!station) {
    station = await prisma.pollingStation.create({
      data: {
        code: "TEST-PS-007",
        name: "Test Library Polling Station",
        wardId: ward.id,
        registeredVoters: 480,
      },
    })
    console.log(`✓ Created: ${station.name}`)
  } else {
    console.log(`✓ Already exists: ${station.name}`)
  }

  console.log(`Station ID: ${station.id}`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })