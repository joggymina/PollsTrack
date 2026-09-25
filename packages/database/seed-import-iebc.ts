import "dotenv/config"
import fs from "fs"
import path from "path"
import { PrismaClient } from "./generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL missing")

const pool = new pg.Pool({
  connectionString,
  max: 1, // one connection — more stable on Neon
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000,
  keepAlive: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type IebcRow = Record<string, string>

function clean(s: string | undefined) {
  return (s ?? "").trim()
}

function parseCsv(text: string): IebcRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  function splitLine(line: string): string[] {
    const out: string[] = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur)
        cur = ""
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out
  }

  const headers = splitLine(lines[0]).map((h) => h.trim())
  const rows: IebcRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i])
    if (cols.every((c) => !c.trim())) continue
    const row: IebcRow = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim()
    })
    rows.push(row)
  }
  return rows
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 5): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      const msg = String(e?.message || e)
      const retriable =
        msg.includes("Connection terminated") ||
        msg.includes("ECONNRESET") ||
        msg.includes("timeout") ||
        msg.includes("Can't reach database") ||
        msg.includes("Connection refused")

      if (!retriable || attempt === retries) throw e

      const wait = attempt * 2000
      console.log(`  ↻ retry ${attempt}/${retries} after ${wait}ms (${label}): ${msg.slice(0, 80)}`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

async function main() {
  const csvPath =
    process.env.IEBC_CSV_PATH ||
    path.join(process.cwd(), "registered_voters_per_polling_station_2022.csv")

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  console.log("Reading:", csvPath)
  const rows = parseCsv(fs.readFileSync(csvPath, "utf-8"))
  console.log(`Rows in CSV: ${rows.length}`)

  // Preload existing station codes → skip fast on resume
  console.log("Loading existing station codes from DB...")
  const existing = await withRetry(
    () =>
      prisma.pollingStation.findMany({
        select: { code: true },
      }),
    "load existing stations"
  )
  const existingCodes = new Set(existing.map((s) => s.code))
  console.log(`Already in DB: ${existingCodes.size}`)
  console.log(`Remaining: ${rows.length - existingCodes.size}\n`)

  const countyByCode = new Map<string, string>()
  const constByKey = new Map<string, string>()
  const wardByKey = new Map<string, string>()

  let countiesCreated = 0
  let constsCreated = 0
  let wardsCreated = 0
  let stationsCreated = 0
  let stationsSkipped = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    const countyCode = clean(r["County Code"])
    const countyName = clean(r["County Name"])
    const constCode = clean(r["Constituency Code"])
    const constName = clean(r["Constituency Name"])
    const cawCode = clean(r["CAW Code"])
    const cawName = clean(r["CAW Name"])
    const stationCode = clean(r["Polling Station Code"])
    const stationName = clean(r["Polling Station Name"])
    const votersRaw = clean(r["Registered Voters"]).replace(/,/g, "")
    const registeredVoters = votersRaw ? parseInt(votersRaw, 10) : null

    if (!countyCode || !constCode || !cawCode || !stationCode) {
      continue
    }

    // Resume: skip stations already imported
    if (existingCodes.has(stationCode)) {
      stationsSkipped++
      if ((i + 1) % 5000 === 0) {
        console.log(`Scanned ${i + 1} / ${rows.length} (skipped ${stationsSkipped}, created ${stationsCreated})`)
      }
      continue
    }

    // County
    let countyId = countyByCode.get(countyCode)
    if (!countyId) {
      const existingCounty = await withRetry(
        () => prisma.county.findFirst({ where: { code: countyCode } }),
        "county find"
      )
      if (existingCounty) {
        countyId = existingCounty.id
      } else {
        const created = await withRetry(
          () =>
            prisma.county.create({
              data: { code: countyCode, name: countyName },
            }),
          "county create"
        )
        countyId = created.id
        countiesCreated++
      }
      countyByCode.set(countyCode, countyId)
    }

    // Constituency
    const constKey = `${countyCode}|${constCode}`
    let constId = constByKey.get(constKey)
    if (!constId) {
      const existingConst = await withRetry(
        () =>
          prisma.constituency.findFirst({
            where: { code: constCode, countyId },
          }),
        "const find"
      )
      if (existingConst) {
        constId = existingConst.id
      } else {
        const created = await withRetry(
          () =>
            prisma.constituency.create({
              data: { code: constCode, name: constName, countyId },
            }),
          "const create"
        )
        constId = created.id
        constsCreated++
      }
      constByKey.set(constKey, constId)
    }

    // Ward
    const wardKey = `${countyCode}|${constCode}|${cawCode}`
    let wardId = wardByKey.get(wardKey)
    if (!wardId) {
      const existingWard = await withRetry(
        () =>
          prisma.ward.findFirst({
            where: { code: cawCode, constituencyId: constId },
          }),
        "ward find"
      )
      if (existingWard) {
        wardId = existingWard.id
      } else {
        const created = await withRetry(
          () =>
            prisma.ward.create({
              data: { code: cawCode, name: cawName, constituencyId: constId },
            }),
          "ward create"
        )
        wardId = created.id
        wardsCreated++
      }
      wardByKey.set(wardKey, wardId)
    }

    // Create station
    await withRetry(
      () =>
        prisma.pollingStation.create({
          data: {
            code: stationCode,
            name: stationName,
            wardId,
            registeredVoters:
              registeredVoters !== null && !Number.isNaN(registeredVoters)
                ? registeredVoters
                : null,
          },
        }),
      `station ${stationCode}`
    )
    existingCodes.add(stationCode)
    stationsCreated++

    if (stationsCreated % 500 === 0) {
      console.log(
        `Created ${stationsCreated} new | skipped ${stationsSkipped} | row ${i + 1}/${rows.length}`
      )
    }
  }

  console.log("\n========================================")
  console.log("IEBC IMPORT COMPLETE (resumable)")
  console.log("========================================")
  console.log(`Counties created      : ${countiesCreated}`)
  console.log(`Constituencies created: ${constsCreated}`)
  console.log(`Wards created         : ${wardsCreated}`)
  console.log(`Stations created      : ${stationsCreated}`)
  console.log(`Stations skipped      : ${stationsSkipped}`)
  console.log(`Total stations in set : ${existingCodes.size}`)
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