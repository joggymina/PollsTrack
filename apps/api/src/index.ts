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

// Health check
app.get('/health', async () => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  }
})

// Test database connection
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

// Root
app.get('/', async () => {
  return { 
    message: 'Polling Station Results API is running',
    version: '1.0.0'
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