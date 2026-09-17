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
    return { 
      status: 'Database connected',
      counties: countyCount
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

// Get all counties
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

// Get a single county by ID
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
        }
      }
    }
  })

  if (!county) {
    return reply.status(404).send({ error: 'County not found' })
  }

  return { data: county }
})

// Create a new county (Admin)
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
      'POST /counties'
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