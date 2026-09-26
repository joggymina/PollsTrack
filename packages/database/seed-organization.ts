import 'dotenv/config'
import { prisma } from './src/client'

async function main() {
  console.log('Seeding default organization...')

  const org = await prisma.organization.upsert({
    where: { slug: 'pollstrack-default' },
    update: {
      name: 'PollsTrack Default',
      primaryLevel: 'NATIONAL',
      isActive: true,
    },
    create: {
      name: 'PollsTrack Default',
      slug: 'pollstrack-default',
      code: 'DEFAULT',
      primaryLevel: 'NATIONAL',
      isActive: true,
    },
  })

  console.log('Organization:', org.id, org.name)

  const users = await prisma.user.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  })
  console.log('Users linked:', users.count)

  const elections = await prisma.election.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  })
  console.log('Elections linked:', elections.count)

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })