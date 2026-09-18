import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fjwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
  })

  // Require a valid JWT
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized – invalid or missing token' })
    }
  })

  // Require AGENT role
  fastify.decorate('requireAgent', async (request: FastifyRequest, reply: FastifyReply) => {
    await (fastify as any).authenticate(request, reply)
    if (reply.sent) return

    if (request.user.role !== 'AGENT') {
      return reply.status(403).send({ error: 'Forbidden – only agents can perform this action' })
    }
  })
}

export default fp(authPlugin)

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
