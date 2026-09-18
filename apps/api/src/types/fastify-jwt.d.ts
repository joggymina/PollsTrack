import '@fastify/jwt'

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