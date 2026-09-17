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

const wardsByConstituencyCode: Record<string, { code: string; name: string }[]> = {
  "001": [ // Changamwe
    { code: "0001", name: "Port Reitz" },
    { code: "0002", name: "Kipevu" },
    { code: "0003", name: "Airport" },
    { code: "0004", name: "Changamwe" },
    { code: "0005", name: "Chaani" },
  ],
  "006": [ // Mvita
    { code: "0026", name: "Mji wa Kale/Makadara" },
    { code: "0027", name: "Tudor" },
    { code: "0028", name: "Tononoka" },
    { code: "0029", name: "Shimanzi/Ganjoni" },
    { code: "0030", name: "Majengo" },
  ],
  "275": [ // Westlands
    { code: "1371", name: "Kitisuru" },
    { code: "1372", name: "Parklands/Highridge" },
    { code: "1373", name: "Karura" },
    { code: "1374", name: "Kangemi" },
    { code: "1375", name: "Mountain View" },
  ],
  "291": [ // Mathare
    { code: "1451", name: "Hospital" },
    { code: "1452", name: "Mabatini" },
    { code: "1453", name: "Huruma" },
    { code: "1454", name: "Ngei" },
    { code: "1455", name: "Mlango Kubwa" },
    { code: "1456", name: "Kiamaiko" },
  ],
}

async function main() {
  console.log("Starting wards seed...")

  const constituencies = await prisma.constituency.findMany({
    where: {
      code: { in: ["001", "006", "275", "291"] }
    }
  })

  console.log(`Found ${constituencies.length} constituencies to seed`)

  let totalCreated = 0

  for (const constituency of constituencies) {
    const list = wardsByConstituencyCode[constituency.code]
    if (!list) continue

    console.log(`\nSeeding wards for ${constituency.name}...`)

    for (const item of list) {
      try {
        await prisma.ward.create({
          data: {
            code: item.code,
            name: item.name,
            constituencyId: constituency.id,
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

  console.log(`\nDone! Created ${totalCreated} wards.`)
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