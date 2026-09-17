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
      'POST /polling-stations'
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