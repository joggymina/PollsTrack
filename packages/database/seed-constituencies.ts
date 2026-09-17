import { PrismaClient } from './generated/prisma/client.js'

const prisma = new PrismaClient()

// Official list of Constituencies grouped by County Code
const constituenciesByCounty: Record<string, { code: string; name: string }[]> = {
  "001": [ // Mombasa
    { code: "001", name: "Changamwe" },
    { code: "002", name: "Jomvu" },
    { code: "003", name: "Kisauni" },
    { code: "004", name: "Nyali" },
    { code: "005", name: "Likoni" },
    { code: "006", name: "Mvita" },
  ],
  "002": [ // Kwale
    { code: "007", name: "Msambweni" },
    { code: "008", name: "Lunga Lunga" },
    { code: "009", name: "Matuga" },
    { code: "010", name: "Kinango" },
  ],
  "003": [ // Kilifi
    { code: "011", name: "Kilifi North" },
    { code: "012", name: "Kilifi South" },
    { code: "013", name: "Kaloleni" },
    { code: "014", name: "Rabai" },
    { code: "015", name: "Ganze" },
    { code: "016", name: "Malindi" },
    { code: "017", name: "Magarini" },
  ],
  // ... (I will give you the full list in the next message if needed)
}

async function main() {
  console.log("Starting constituency seed...")

  const counties = await prisma.county.findMany()
  console.log(`Found ${counties.length} counties`)

  let totalCreated = 0

  for (const county of counties) {
    const list = constituenciesByCounty[county.code]
    if (!list) {
      console.log(`No constituencies defined for county ${county.code} - ${county.name}`)
      continue
    }

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
        console.log(`Created: ${item.code} - ${item.name}`)
      } catch (error: any) {
        if (error.code === "P2002") {
          console.log(`Already exists: ${item.code} - ${item.name}`)
        } else {
          console.error(`Error creating ${item.name}:`, error.message)
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
  })