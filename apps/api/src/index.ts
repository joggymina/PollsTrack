import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import { prisma } from '@polling/database'
import authPlugin from './plugins/auth.js'

dotenv.config()

const app = Fastify({
  logger: true
})

await app.register(cors, {
  origin: true
})

await app.register(authPlugin)

// ======================
// HEALTH & TEST
// ======================

app.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString()
  }
})

app.get('/db-test', async () => {
  try {
    const countyCount = await prisma.county.count()
    const stationCount = await prisma.pollingStation.count()
    return {
      status: 'Database connected',
      counties: countyCount,
      pollingStations: stationCount
    }
  } catch (error: any) {
    return {
      status: 'Database error',
      message: error.message
    }
  }
})

// ======================
// AUTH
// ======================

app.post('/auth/login', async (request, reply) => {
  const body = request.body as { phone?: string }

  if (!body.phone || typeof body.phone !== 'string') {
    return reply.status(400).send({ error: 'phone is required' })
  }

  const phone = body.phone.trim()

  const user = await prisma.user.findUnique({
    where: { phone },
  })

  if (!user || !user.isActive) {
    return reply.status(401).send({ error: 'Invalid phone number or account inactive' })
  }

  if (user.role !== 'AGENT' && user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({ error: 'Only agents can use this portal' })
  }

  const token = app.jwt.sign({
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  }
})

// ======================
// ME (current agent)
// ======================

app.get('/me', {
  preHandler: [app.authenticate],
}, async (request, reply) => {
  const payload = request.user as { id: string }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      agentAssignments: {
        select: {
          pollingStation: {
            select: {
              id: true,
              code: true,
              name: true,
              registeredVoters: true,  // ← add this
              ward: {
                select: {
                  id: true,
                  name: true,
                  constituency: {
                    select: {
                      id: true,
                      name: true,
                      county: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user || !user.isActive) {
    return reply.status(401).send({ error: 'User not found or inactive' })
  }

  return {
    data: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      assignedStations: user.agentAssignments.map((a) => a.pollingStation),
    },
  }
})

// ======================
// RACES & CANDIDATES
// ======================

app.get('/races', async () => {
  const races = await prisma.race.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      position: true,
      scope: true,
    },
  })
  return { data: races }
})

app.get('/races/:id/candidates', async (request, reply) => {
  const { id } = request.params as { id: string }

  const candidates = await prisma.candidate.findMany({
    where: { raceId: id, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      party: true,
      raceId: true,
    },
  })

  return { data: candidates }
})

// ======================
// COUNTIES
// ======================

app.get('/counties', async () => {
  const counties = await prisma.county.findMany({
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      createdAt: true
    }
  })
  return { data: counties }
})

app.get('/counties/:id', async (request, reply) => {
  const { id } = request.params as { id: string }

  const county = await prisma.county.findUnique({
    where: { id },
    include: {
      constituencies: {
        select: {
          id: true,
          code: true,
          name: true
        },
        orderBy: { code: 'asc' }
      }
    }
  })

  if (!county) {
    return reply.status(404).send({ error: 'County not found' })
  }

  return { data: county }
})

app.post('/counties', async (request, reply) => {
  const body = request.body as { code: string; name: string }

  if (!body.code || !body.name) {
    return reply.status(400).send({ error: 'code and name are required' })
  }

  try {
    const county = await prisma.county.create({
      data: {
        code: body.code,
        name: body.name
      }
    })
    return reply.status(201).send({ data: county })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'County with this code already exists' })
    }
    throw error
  }
})

// ======================
// CONSTITUENCIES
// ======================

app.get('/constituencies', async (request) => {
  const { countyId } = request.query as { countyId?: string }

  const constituencies = await prisma.constituency.findMany({
    where: countyId ? { countyId } : undefined,
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      countyId: true,
      county: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  })

  return { data: constituencies }
})

app.get('/constituencies/:id', async (request, reply) => {
  const { id } = request.params as { id: string }

  const constituency = await prisma.constituency.findUnique({
    where: { id },
    include: {
      county: {
        select: { id: true, code: true, name: true }
      },
      wards: {
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' }
      }
    }
  })

  if (!constituency) {
    return reply.status(404).send({ error: 'Constituency not found' })
  }

  return { data: constituency }
})

app.post('/constituencies', async (request, reply) => {
  const body = request.body as {
    code: string
    name: string
    countyId: string
  }

  if (!body.code || !body.name || !body.countyId) {
    return reply.status(400).send({
      error: 'code, name and countyId are required'
    })
  }

  try {
    const constituency = await prisma.constituency.create({
      data: {
        code: body.code,
        name: body.name,
        countyId: body.countyId
      }
    })
    return reply.status(201).send({ data: constituency })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Constituency with this code already exists' })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid countyId' })
    }
    throw error
  }
})

// ======================
// WARDS
// ======================

app.get('/wards', async (request) => {
  const { constituencyId } = request.query as { constituencyId?: string }

  const wards = await prisma.ward.findMany({
    where: constituencyId ? { constituencyId } : undefined,
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      constituencyId: true,
      constituency: {
        select: {
          id: true,
          code: true,
          name: true,
          county: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      }
    }
  })

  return { data: wards }
})

app.get('/wards/:id', async (request, reply) => {
  const { id } = request.params as { id: string }

  const ward = await prisma.ward.findUnique({
    where: { id },
    include: {
      constituency: {
        select: {
          id: true,
          code: true,
          name: true,
          county: {
            select: { id: true, code: true, name: true }
          }
        }
      },
      pollingStations: {
        select: {
          id: true,
          code: true,
          name: true,
          registeredVoters: true
        },
        orderBy: { code: 'asc' }
      }
    }
  })

  if (!ward) {
    return reply.status(404).send({ error: 'Ward not found' })
  }

  return { data: ward }
})

app.post('/wards', async (request, reply) => {
  const body = request.body as {
    code: string
    name: string
    constituencyId: string
  }

  if (!body.code || !body.name || !body.constituencyId) {
    return reply.status(400).send({
      error: 'code, name and constituencyId are required'
    })
  }

  try {
    const ward = await prisma.ward.create({
      data: {
        code: body.code,
        name: body.name,
        constituencyId: body.constituencyId
      }
    })
    return reply.status(201).send({ data: ward })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Ward with this code already exists' })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid constituencyId' })
    }
    throw error
  }
})

// ======================
// POLLING STATIONS
// ======================

app.get('/polling-stations', async (request) => {
  const { wardId } = request.query as { wardId?: string }

  const stations = await prisma.pollingStation.findMany({
    where: wardId ? { wardId } : undefined,
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      registeredVoters: true,
      wardId: true,
      ward: {
        select: {
          id: true,
          code: true,
          name: true,
          constituency: {
            select: {
              id: true,
              code: true,
              name: true,
              county: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  })

  return { data: stations }
})

app.get('/polling-stations/:id', async (request, reply) => {
  const { id } = request.params as { id: string }

  const station = await prisma.pollingStation.findUnique({
    where: { id },
    include: {
      ward: {
        select: {
          id: true,
          code: true,
          name: true,
          constituency: {
            select: {
              id: true,
              code: true,
              name: true,
              county: {
                select: { id: true, code: true, name: true }
              }
            }
          }
        }
      }
    }
  })

  if (!station) {
    return reply.status(404).send({ error: 'Polling station not found' })
  }

  return { data: station }
})

app.post('/polling-stations', async (request, reply) => {
  const body = request.body as {
    code: string
    name: string
    wardId: string
    registeredVoters?: number
  }

  if (!body.code || !body.name || !body.wardId) {
    return reply.status(400).send({
      error: 'code, name and wardId are required'
    })
  }

  try {
    const station = await prisma.pollingStation.create({
      data: {
        code: body.code,
        name: body.name,
        wardId: body.wardId,
        registeredVoters: body.registeredVoters ?? null
      }
    })
    return reply.status(201).send({ data: station })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Polling station with this code already exists' })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid wardId' })
    }
    throw error
  }
})

// ======================
// RESULTS (CORE FEATURE)
// ======================

/**
 * Submit results for a polling station + race
 * Uses JWT authenticated agent (no submittedById in body)
 */
app.post('/results', {
  preHandler: [app.requireAgent],
}, async (request, reply) => {
  const body = request.body as {
    pollingStationId: string
    raceId: string
    totalRegistered?: number
    totalVoted?: number
    rejectedBallots?: number
    clientSubmittedAt: string
    isOffline?: boolean
    formPhotoUrl?: string
    formPhotoHash?: string
    deviceInfo?: Record<string, unknown>
    votes: { candidateId: string; votes: number }[]
  }

  const user = request.user as { id: string; role: string }

  if (!body.pollingStationId || !body.raceId || !body.clientSubmittedAt) {
    return reply.status(400).send({
      error: 'pollingStationId, raceId and clientSubmittedAt are required',
    })
  }

  if (!Array.isArray(body.votes) || body.votes.length === 0) {
    return reply.status(400).send({
      error: 'votes array is required and must not be empty',
    })
  }

  for (const v of body.votes) {
    if (!v.candidateId || typeof v.votes !== 'number' || v.votes < 0) {
      return reply.status(400).send({
        error: 'Each vote must have candidateId and a non-negative votes number',
      })
    }
  }

  // Check the agent is assigned to this station
  const assignment = await prisma.agentAssignment.findFirst({
    where: {
      userId: user.id,
      pollingStationId: body.pollingStationId,
    },
  })

  if (!assignment && user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      error: 'You are not assigned to this polling station',
    })
  }

  try {
    const stationResult = await prisma.stationResult.create({
      data: {
        pollingStationId: body.pollingStationId,
        raceId: body.raceId,
        submittedById: user.id,
        totalRegistered: body.totalRegistered ?? null,
        totalVoted: body.totalVoted ?? null,
        rejectedBallots: body.rejectedBallots ?? 0,
        clientSubmittedAt: new Date(body.clientSubmittedAt),
        isOffline: body.isOffline ?? false,
        formPhotoUrl: body.formPhotoUrl ?? null,
        formPhotoHash: body.formPhotoHash ?? null,
        deviceInfo: body.deviceInfo ?? undefined,
        status: 'SUBMITTED',
        votes: {
          create: body.votes.map((v) => ({
            candidateId: v.candidateId,
            votes: v.votes,
          })),
        },
      },
      include: {
        votes: {
          include: {
            candidate: {
              select: { id: true, name: true, code: true, party: true },
            },
          },
        },
        pollingStation: {
          select: { id: true, code: true, name: true },
        },
        race: {
          select: { id: true, position: true },
        },
      },
    })

    // Audit log (best-effort)
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'RESULT_SUBMITTED',
          entityType: 'StationResult',
          entityId: stationResult.id,
          details: {
            pollingStationId: body.pollingStationId,
            raceId: body.raceId,
            totalVoted: body.totalVoted,
            isOffline: body.isOffline ?? false,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        },
      })
    } catch (auditError) {
      console.error('Audit log failed (result still saved):', auditError)
    }

    return reply.status(201).send({ data: stationResult })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({
        error: 'Results for this polling station and race have already been submitted',
      })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({
        error: 'Invalid pollingStationId, raceId or candidateId',
      })
    }
    throw error
  }
})

/**
 * List results (optional filters)
 */
app.get('/results', async (request) => {
  const { raceId, pollingStationId, status } = request.query as {
    raceId?: string
    pollingStationId?: string
    status?: string
  }

  const results = await prisma.stationResult.findMany({
    where: {
      ...(raceId ? { raceId } : {}),
      ...(pollingStationId ? { pollingStationId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { serverReceivedAt: 'desc' },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
      pollingStation: {
        select: { id: true, code: true, name: true },
      },
      race: {
        select: { id: true, position: true },
      },
      submittedBy: {
        select: { id: true, name: true, phone: true },
      },
    },
  })

  return { data: results }
})

/**
 * Get a single result by ID
 */
app.get('/results/:id', async (request, reply) => {
  const { id } = request.params as { id: string }

  const result = await prisma.stationResult.findUnique({
    where: { id },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
      pollingStation: {
        select: {
          id: true,
          code: true,
          name: true,
          ward: {
            select: {
              id: true,
              name: true,
              constituency: {
                select: {
                  id: true,
                  name: true,
                  county: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      race: {
        select: {
          id: true,
          position: true,
          election: { select: { id: true, name: true } },
        },
      },
      submittedBy: {
        select: { id: true, name: true, phone: true },
      },
    },
  })

  if (!result) {
    return reply.status(404).send({ error: 'Result not found' })
  }

  return { data: result }
})

// ======================
// AGGREGATION (REAL-TIME TOTALS)
// ======================

function buildCandidateTotals(votes: { candidateId: string; votes: number; candidate: { id: string; name: string; code: string | null; party: string | null } }[]) {
  const map = new Map<string, { candidateId: string; name: string; code: string | null; party: string | null; totalVotes: number }>()

  for (const v of votes) {
    const existing = map.get(v.candidateId)
    if (existing) {
      existing.totalVotes += v.votes
    } else {
      map.set(v.candidateId, {
        candidateId: v.candidate.id,
        name: v.candidate.name,
        code: v.candidate.code,
        party: v.candidate.party,
        totalVotes: v.votes,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalVotes - a.totalVotes)
}

app.get('/results/aggregate/national', async (request, reply) => {
  const { raceId } = request.query as { raceId?: string }

  if (!raceId) {
    return reply.status(400).send({ error: 'raceId is required' })
  }

  const results = await prisma.stationResult.findMany({
    where: { raceId, status: 'SUBMITTED' },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
    },
  })

  const allVotes = results.flatMap((r) => r.votes)
  const candidates = buildCandidateTotals(allVotes)

  const totalVoted = results.reduce((sum, r) => sum + (r.totalVoted ?? 0), 0)
  const totalRejected = results.reduce((sum, r) => sum + (r.rejectedBallots ?? 0), 0)
  const stationsReported = results.length

  return {
    data: {
      level: 'NATIONAL',
      raceId,
      stationsReported,
      totalVoted,
      totalRejected,
      candidates,
    },
  }
})

app.get('/results/aggregate/county/:countyId', async (request, reply) => {
  const { countyId } = request.params as { countyId: string }
  const { raceId } = request.query as { raceId?: string }

  if (!raceId) {
    return reply.status(400).send({ error: 'raceId is required' })
  }

  const results = await prisma.stationResult.findMany({
    where: {
      raceId,
      status: 'SUBMITTED',
      pollingStation: {
        ward: {
          constituency: {
            countyId,
          },
        },
      },
    },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
      pollingStation: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  })

  const allVotes = results.flatMap((r) => r.votes)
  const candidates = buildCandidateTotals(allVotes)

  const totalVoted = results.reduce((sum, r) => sum + (r.totalVoted ?? 0), 0)
  const totalRejected = results.reduce((sum, r) => sum + (r.rejectedBallots ?? 0), 0)

  return {
    data: {
      level: 'COUNTY',
      countyId,
      raceId,
      stationsReported: results.length,
      totalVoted,
      totalRejected,
      candidates,
    },
  }
})

app.get('/results/aggregate/constituency/:constituencyId', async (request, reply) => {
  const { constituencyId } = request.params as { constituencyId: string }
  const { raceId } = request.query as { raceId?: string }

  if (!raceId) {
    return reply.status(400).send({ error: 'raceId is required' })
  }

  const results = await prisma.stationResult.findMany({
    where: {
      raceId,
      status: 'SUBMITTED',
      pollingStation: {
        ward: {
          constituencyId,
        },
      },
    },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
    },
  })

  const allVotes = results.flatMap((r) => r.votes)
  const candidates = buildCandidateTotals(allVotes)

  const totalVoted = results.reduce((sum, r) => sum + (r.totalVoted ?? 0), 0)
  const totalRejected = results.reduce((sum, r) => sum + (r.rejectedBallots ?? 0), 0)

  return {
    data: {
      level: 'CONSTITUENCY',
      constituencyId,
      raceId,
      stationsReported: results.length,
      totalVoted,
      totalRejected,
      candidates,
    },
  }
})

app.get('/results/aggregate/ward/:wardId', async (request, reply) => {
  const { wardId } = request.params as { wardId: string }
  const { raceId } = request.query as { raceId?: string }

  if (!raceId) {
    return reply.status(400).send({ error: 'raceId is required' })
  }

  const results = await prisma.stationResult.findMany({
    where: {
      raceId,
      status: 'SUBMITTED',
      pollingStation: {
        wardId,
      },
    },
    include: {
      votes: {
        include: {
          candidate: {
            select: { id: true, name: true, code: true, party: true },
          },
        },
      },
      pollingStation: {
        select: { id: true, code: true, name: true },
      },
    },
  })

  const allVotes = results.flatMap((r) => r.votes)
  const candidates = buildCandidateTotals(allVotes)

  const totalVoted = results.reduce((sum, r) => sum + (r.totalVoted ?? 0), 0)
  const totalRejected = results.reduce((sum, r) => sum + (r.rejectedBallots ?? 0), 0)

  return {
    data: {
      level: 'WARD',
      wardId,
      raceId,
      stationsReported: results.length,
      totalVoted,
      totalRejected,
      candidates,
      stations: results.map((r) => ({
        id: r.pollingStation.id,
        code: r.pollingStation.code,
        name: r.pollingStation.name,
        totalVoted: r.totalVoted,
      })),
    },
  }
})

// ======================
// ADMIN
// ======================

app.get(
  '/admin/agents',
  {
    preHandler: [app.requireSuperAdmin],
  },
  async () => {
    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'SUPER_ADMIN'] } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        agentAssignments: {
          select: {
            pollingStation: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    })

    return {
      data: agents.map((a) => ({
        id: a.id,
        name: a.name,
        phone: a.phone,
        role: a.role,
        isActive: a.isActive,
        createdAt: a.createdAt,
        stations: a.agentAssignments.map((x) => x.pollingStation),
      })),
    }
  }
)

app.post(
  '/admin/agents',
  {
    preHandler: [app.requireSuperAdmin],
  },
  async (request, reply) => {
    const body = request.body as {
      phone?: string
      name?: string
      role?: string
    }

    if (!body.phone || !body.name) {
      return reply.status(400).send({ error: 'phone and name are required' })
    }

    const phone = body.phone.trim()
    const role = body.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'AGENT'

    try {
      const user = await prisma.user.create({
        data: {
          phone,
          name: body.name.trim(),
          role,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
        },
      })
      return reply.status(201).send({ data: user })
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply
          .status(409)
          .send({ error: 'Phone number already registered' })
      }
      throw error
    }
  }
)

app.post(
  '/admin/assignments',
  {
    preHandler: [app.requireSuperAdmin],
  },
  async (request, reply) => {
    const body = request.body as {
      userId?: string
      pollingStationId?: string
    }

    if (!body.userId || !body.pollingStationId) {
      return reply.status(400).send({
        error: 'userId and pollingStationId are required',
      })
    }

    const existing = await prisma.agentAssignment.findFirst({
      where: {
        userId: body.userId,
        pollingStationId: body.pollingStationId,
      },
    })

    if (existing) {
      return reply
        .status(409)
        .send({ error: 'Agent already assigned to this station' })
    }

    try {
      const assignment = await prisma.agentAssignment.create({
        data: {
          userId: body.userId,
          pollingStationId: body.pollingStationId,
        },
        include: {
          pollingStation: {
            select: { id: true, code: true, name: true },
          },
        },
      })
      return reply.status(201).send({ data: assignment })
    } catch (error: any) {
      if (error.code === 'P2003') {
        return reply
          .status(400)
          .send({ error: 'Invalid userId or pollingStationId' })
      }
      throw error
    }
  }
)

// ======================
// ROOT
// ======================

app.get('/', async () => {
  return {
    message: 'PollsTrack API is running',
    version: '1.0.0',
    endpoints: [
      'GET  /health',
      'GET  /db-test',
      'POST /auth/login',
      'GET  /me',
      'GET  /races',
      'GET  /races/:id/candidates',
      'GET  /counties',
      'GET  /counties/:id',
      'POST /counties',
      'GET  /constituencies',
      'GET  /constituencies?countyId=xxx',
      'GET  /constituencies/:id',
      'POST /constituencies',
      'GET  /wards',
      'GET  /wards?constituencyId=xxx',
      'GET  /wards/:id',
      'POST /wards',
      'GET  /polling-stations',
      'GET  /polling-stations?wardId=xxx',
      'GET  /polling-stations/:id',
      'POST /polling-stations',
      'POST /results',
      'GET  /results',
      'GET  /results?raceId=xxx',
      'GET  /results?pollingStationId=xxx',
      'GET  /results/:id',
      'GET  /results/aggregate/national?raceId=xxx',
      'GET  /results/aggregate/county/:countyId?raceId=xxx',
      'GET  /results/aggregate/constituency/:constituencyId?raceId=xxx',
      'GET  /results/aggregate/ward/:wardId?raceId=xxx',
      'GET  /admin/agents',
      'POST /admin/agents',
      'POST /admin/assignments',
    ]
  }
})

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`Server running on http://0.0.0.0:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()