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
  const phone = "254700000000"
  let admin = await prisma.user.findFirst({ where: { phone } })

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        phone,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    })
    console.log(`✓ Created SUPER_ADMIN: ${admin.name} (${admin.phone})`)
  } else if (admin.role !== "SUPER_ADMIN") {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { role: "SUPER_ADMIN" },
    })
    console.log(`✓ Updated to SUPER_ADMIN: ${admin.phone}`)
  } else {
    console.log(`✓ SUPER_ADMIN already exists: ${admin.phone}`)
  }

  console.log(`\nAdmin login phone: ${phone}\n`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })