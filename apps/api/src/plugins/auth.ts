import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fjwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
  })

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
      } catch {
        return reply
          .status(401)
          .send({ error: 'Unauthorized – invalid or missing token' })
      }
    }
  )

  fastify.decorate(
    'requireAgent',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await (fastify as any).authenticate(request, reply)
      if (reply.sent) return

      const user = request.user as { role: string }
      if (user.role !== 'AGENT' && user.role !== 'SUPER_ADMIN') {
        return reply
          .status(403)
          .send({ error: 'Forbidden – only agents can perform this action' })
      }
    }
  )

  fastify.decorate(
    'requireSuperAdmin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await (fastify as any).authenticate(request, reply)
      if (reply.sent) return

      const user = request.user as { role: string }
      if (user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'Super admin only' })
      }
    }
  )

  fastify.decorate(
    'requirePositionAdmin',
    async (request: FastifyRequest, reply: FastifyReply) => {
      await (fastify as any).authenticate(request, reply)
      if (reply.sent) return

      const user = request.user as { role: string }
      if (user.role !== 'POSITION_ADMIN' && user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'Position admin only' })
      }
    }
  )
}

export default fp(authPlugin)

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
    requireAgent: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
    requireSuperAdmin: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
    requirePositionAdmin: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string
      phone: string
      name: string
      role: string
    }
    user: {
      id: string
      phone: string
      name: string
      role: string
    }
  }
}