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

/**
 * Login with phone number (Kenyan format: 2547XXXXXXXX)
 * No password for now – OTP can be added later
 */
app.post('/auth/login', async (request, reply) => {
  const body = request.body as { phone?: string }

  if (!body.phone) {
    return reply.status(400).send({ error: 'phone is required' })
  }

  // Normalize Kenyan mobile number
  let phone = body.phone.replace(/\s+/g, '')
  if (phone.startsWith('07')) phone = '254' + phone.slice(1)
  if (phone.startsWith('+254')) phone = phone.slice(1)

  const kenyanPhoneRegex = /^2547\d{8}$/
  if (!kenyanPhoneRegex.test(phone)) {
    return reply.status(400).send({
      error: 'Invalid phone number. Use format 2547XXXXXXXX',
    })
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      isActive: true,
    },
  })

  if (!user || !user.isActive) {
    return reply.status(401).send({ error: 'User not found or inactive' })
  }

  const token = app.jwt.sign({
    userId: user.id,
    role: user.role,
    phone: user.phone,
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

/**
 * Get current authenticated user + assigned stations
 */
app.get('/me', {
  preHandler: [app.authenticate],
}, async (request, reply) => {
  const userId = request.user.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
              ward: {
                select: {
                  id: true,
                  name: true,
                  constituency: {
                    select: {
                      id: true,
                      name: true,
                      county: {
                        select: { id: true, name: true },
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

  if (!user) {
    return reply.status(404).send({ error: 'User not found' })
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
// RESULTS (CORE FEATURE) - PROTECTED
// ======================

/**
 * Submit results for a polling station + race
 * Protected: only authenticated agents can submit
 * Agent can only submit for stations they are assigned to
 * (No interactive transaction – works with Neon pooler)
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

  // Use the authenticated user – never trust submittedById from client
  const submittedById = request.user.userId

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

  // Security: verify agent is assigned to this station
  const assignment = await prisma.agentAssignment.findUnique({
    where: {
      userId_pollingStationId: {
        userId: submittedById,
        pollingStationId: body.pollingStationId,
      },
    },
  })

  if (!assignment) {
    return reply.status(403).send({
      error: 'You are not assigned to this polling station',
    })
  }

  try {
    const stationResult = await prisma.stationResult.create({
      data: {
        pollingStationId: body.pollingStationId,
        raceId: body.raceId,
        submittedById,
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
          userId: submittedById,
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

/**
 * Helper: build candidate totals from a list of ResultVotes
 */
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

/**
 * NATIONAL aggregation
 * GET /results/aggregate/national?raceId=xxx
 */
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

/**
 * COUNTY aggregation
 * GET /results/aggregate/county/:countyId?raceId=xxx
 */
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

/**
 * CONSTITUENCY aggregation
 * GET /results/aggregate/constituency/:constituencyId?raceId=xxx
 */
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

/**
 * WARD aggregation
 * GET /results/aggregate/ward/:wardId?raceId=xxx
 */
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
// ROOT
// ======================

app.get('/', async () => {
  return { 
    message: 'PollsTrack API is running',
    version: '1.1.0',
    endpoints: [
      'POST /auth/login',
      'GET  /me',
      'GET  /health',
      'GET  /db-test',
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
      'POST /results          (protected – agent only)',
      'GET  /results',
      'GET  /results?raceId=xxx',
      'GET  /results?pollingStationId=xxx',
      'GET  /results/:id',
      'GET  /results/aggregate/national?raceId=xxx',
      'GET  /results/aggregate/county/:countyId?raceId=xxx',
      'GET  /results/aggregate/constituency/:constituencyId?raceId=xxx',
      'GET  /results/aggregate/ward/:wardId?raceId=xxx',
    ]
  }
})

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()