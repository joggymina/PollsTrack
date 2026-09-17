import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is missing in .env")
}

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const stationsByWardCode: Record<string, { code: string; name: string; registeredVoters?: number }[]> = {
  "0001": [ // Port Reitz
    { code: "001001001001", name: "Port Reitz Primary School", registeredVoters: 1250 },
    { code: "001001001002", name: "Port Reitz Social Hall", registeredVoters: 980 },
  ],
  "0004": [ // Changamwe
    { code: "001001004001", name: "Changamwe Primary School", registeredVoters: 1420 },
    { code: "001001004002", name: "Changamwe Secondary School", registeredVoters: 1105 },
  ],
  "1371": [ // Kitisuru
    { code: "0472751371001", name: "Kitisuru Primary School", registeredVoters: 890 },
    { code: "0472751371002", name: "Highridge Primary School", registeredVoters: 1120 },
  ],
  "1451": [ // Hospital (Mathare)
    { code: "0472911451001", name: "Mathare North Primary School", registeredVoters: 1560 },
    { code: "0472911451002", name: "Hospital Ward Polling Centre", registeredVoters: 1340 },
  ],
}

async function main() {
  console.log("Starting polling stations seed...")

  const wards = await prisma.ward.findMany({
    where: {
      code: { in: ["0001", "0004", "1371", "1451"] }
    }
  })

  console.log(`Found ${wards.length} wards to seed`)

  let totalCreated = 0

  for (const ward of wards) {
    const list = stationsByWardCode[ward.code]
    if (!list) continue

    console.log(`\nSeeding stations for ${ward.name}...`)

    for (const item of list) {
      try {
        await prisma.pollingStation.create({
          data: {
            code: item.code,
            name: item.name,
            wardId: ward.id,
            registeredVoters: item.registeredVoters ?? null,
          },
        })
        totalCreated++
        console.log(`  ✓ ${item.code} - ${item.name}`)
      } catch (error: any) {
        if (error.code === "P2002") {
          console.log(`  → Already exists: ${item.name}`)
        } else {
          console.error(`  ✗ Error: ${item.name}`, error.message)
        }
      }
    }
  }

  console.log(`\nDone! Created ${totalCreated} polling stations.`)
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