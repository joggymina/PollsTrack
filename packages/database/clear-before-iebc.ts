import "dotenv/config"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL missing")

const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function deleteManySafe(
  label: string,
  fn: () => Promise<{ count: number }>
) {
  try {
    const result = await fn()
    console.log(`✓ ${label} deleted: ${result.count}`)
  } catch (e: any) {
    console.log(`· ${label} skipped: ${e?.message?.slice(0, 120) || e}`)
  }
}

async function main() {
  console.log("Clearing geo + results data before IEBC import...\n")
  console.log(
    "⚠️  Deletes results, assignments, stations, wards, constituencies, counties."
  )
  console.log("   Test AGENT users are deleted. SUPER_ADMIN is kept.\n")

  // 1. Votes — try common Prisma model names
  const voteAttempts: Array<[string, () => Promise<{ count: number }>]> = [
    ["votes (vote)", () => (prisma as any).vote.deleteMany({})],
    ["votes (resultVote)", () => (prisma as any).resultVote.deleteMany({})],
    [
      "votes (stationResultVote)",
      () => (prisma as any).stationResultVote.deleteMany({}),
    ],
    [
      "votes (candidateVote)",
      () => (prisma as any).candidateVote.deleteMany({}),
    ],
  ]

  let votesCleared = false
  for (const [label, fn] of voteAttempts) {
    try {
      const result = await fn()
      console.log(`✓ ${label} deleted: ${result.count}`)
      votesCleared = true
      break
    } catch {
      // try next
    }
  }
  if (!votesCleared) {
    console.log(
      "· Vote model not found by name — will rely on stationResult delete (cascade if configured)"
    )
  }

  // 2. Station results
  await deleteManySafe("station results", () =>
    prisma.stationResult.deleteMany({})
  )

  // 3. Audit logs
  await deleteManySafe("audit logs", () =>
    (prisma as any).auditLog.deleteMany({})
  )

  // 4. Agent assignments (must go before stations / agent users)
  await deleteManySafe("agent assignments", () =>
    prisma.agentAssignment.deleteMany({})
  )

  // 5. Polling stations
  await deleteManySafe("polling stations", () =>
    prisma.pollingStation.deleteMany({})
  )

  // 6. Wards
  await deleteManySafe("wards", () => prisma.ward.deleteMany({}))

  // 7. Constituencies
  await deleteManySafe("constituencies", () =>
    prisma.constituency.deleteMany({})
  )

  // 8. Counties
  await deleteManySafe("counties", () => prisma.county.deleteMany({}))

  // 9. Remove test agents only (keep SUPER_ADMIN)
  await deleteManySafe("AGENT users", () =>
    prisma.user.deleteMany({
      where: { role: "AGENT" },
    })
  )

  // List remaining users
  const users = await prisma.user.findMany({
    select: { phone: true, name: true, role: true },
    orderBy: { phone: "asc" },
  })

  console.log("\n========================================")
  console.log("CLEAR COMPLETE")
  console.log("========================================")
  console.log("Users still in DB:")
  if (users.length === 0) {
    console.log("  (none — re-run seed-super-admin.ts if needed)")
  } else {
    for (const u of users) {
      console.log(`  ${u.phone}  ${u.name}  (${u.role})`)
    }
  }
  console.log("\nNext: run seed-import-iebc.ts")
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