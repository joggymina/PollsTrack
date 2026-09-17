import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import { prisma } from '@polling/database'

dotenv.config()

const app = Fastify({
  logger: true
})

await app.register(cors, {
  origin: true
})

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
 */
app.post('/results', async (request, reply) => {
  const body = request.body as {
    pollingStationId: string
    raceId: string
    submittedById: string
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

  if (!body.pollingStationId || !body.raceId || !body.submittedById || !body.clientSubmittedAt) {
    return reply.status(400).send({
      error: 'pollingStationId, raceId, submittedById and clientSubmittedAt are required'
    })
  }

  if (!Array.isArray(body.votes) || body.votes.length === 0) {
    return reply.status(400).send({
      error: 'votes array is required and must not be empty'
    })
  }

  for (const v of body.votes) {
    if (!v.candidateId || typeof v.votes !== 'number' || v.votes < 0) {
      return reply.status(400).send({
        error: 'Each vote must have candidateId and a non-negative votes number'
      })
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stationResult = await tx.stationResult.create({
        data: {
          pollingStationId: body.pollingStationId,
          raceId: body.raceId,
          submittedById: body.submittedById,
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

      await tx.auditLog.create({
        data: {
          userId: body.submittedById,
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

      return stationResult
    })

    return reply.status(201).send({ data: result })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({
        error: 'Results for this polling station and race have already been submitted'
      })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({
        error: 'Invalid pollingStationId, raceId, submittedById or candidateId'
      })
    }
    throw error
  }
})

/**
 * List results (optional filters)
 */
app.post('/results', async (request, reply) => {
  const body = request.body as {
    pollingStationId: string
    raceId: string
    submittedById: string
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

  if (!body.pollingStationId || !body.raceId || !body.submittedById || !body.clientSubmittedAt) {
    return reply.status(400).send({
      error: 'pollingStationId, raceId, submittedById and clientSubmittedAt are required'
    })
  }

  if (!Array.isArray(body.votes) || body.votes.length === 0) {
    return reply.status(400).send({
      error: 'votes array is required and must not be empty'
    })
  }

  for (const v of body.votes) {
    if (!v.candidateId || typeof v.votes !== 'number' || v.votes < 0) {
      return reply.status(400).send({
        error: 'Each vote must have candidateId and a non-negative votes number'
      })
    }
  }

  try {
    // Create result + votes in one query (no interactive transaction)
    const stationResult = await prisma.stationResult.create({
      data: {
        pollingStationId: body.pollingStationId,
        raceId: body.raceId,
        submittedById: body.submittedById,
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

    // Audit log (best-effort – does not fail the submission)
    try {
      await prisma.auditLog.create({
        data: {
          userId: body.submittedById,
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
        error: 'Results for this polling station and race have already been submitted'
      })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({
        error: 'Invalid pollingStationId, raceId, submittedById or candidateId'
      })
    }
    throw error
  }
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
// ROOT
// ======================

app.get('/', async () => {
  return { 
    message: 'PollsTrack API is running',
    version: '1.0.0',
    endpoints: [
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
      'POST /results',
      'GET  /results',
      'GET  /results?raceId=xxx',
      'GET  /results?pollingStationId=xxx',
      'GET  /results/:id'
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