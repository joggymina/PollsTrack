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

const constituenciesByCounty: Record<string, { code: string; name: string }[]> = {
  "001": [ // Mombasa
    { code: "001", name: "Changamwe" },
    { code: "002", name: "Jomvu" },
    { code: "003", name: "Kisauni" },
    { code: "004", name: "Nyali" },
    { code: "005", name: "Likoni" },
    { code: "006", name: "Mvita" },
  ],
  "047": [ // Nairobi
    { code: "275", name: "Westlands" },
    { code: "276", name: "Dagoretti North" },
    { code: "277", name: "Dagoretti South" },
    { code: "278", name: "Langata" },
    { code: "279", name: "Kibra" },
    { code: "280", name: "Roysambu" },
    { code: "281", name: "Kasarani" },
    { code: "282", name: "Ruaraka" },
    { code: "283", name: "Embakasi South" },
    { code: "284", name: "Embakasi North" },
    { code: "285", name: "Embakasi Central" },
    { code: "286", name: "Embakasi East" },
    { code: "287", name: "Embakasi West" },
    { code: "288", name: "Makadara" },
    { code: "289", name: "Kamukunji" },
    { code: "290", name: "Starehe" },
    { code: "291", name: "Mathare" },
  ],
}

async function main() {
  console.log("Starting constituency seed (Mombasa + Nairobi only)...")

  const counties = await prisma.county.findMany({
    where: {
      code: { in: ["001", "047"] }
    }
  })

  console.log(`Found ${counties.length} counties to seed`)

  let totalCreated = 0

  for (const county of counties) {
    const list = constituenciesByCounty[county.code]
    if (!list) continue

    console.log(`\nSeeding ${county.name}...`)

    for (const item of list) {
      try {
        await prisma.constituency.create({
          data: {
            code: item.code,
            name: item.name,
            countyId: county.id,
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

  console.log(`\nDone! Created ${totalCreated} constituencies.`)
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