import { createApp } from '../../src/app.js'
import { prisma } from '../../src/plugins/prisma.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  return createApp({ logger: false })
}

export async function cleanDb() {
  await prisma.checklistResponse.deleteMany()
  await prisma.tripChecklist.deleteMany()
  await prisma.kmLog.deleteMany()
  await prisma.tripCost.deleteMany()
  await prisma.trip.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()
}
