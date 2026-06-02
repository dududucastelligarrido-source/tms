import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import { tenantScope } from '../middleware/tenant-scope.js'
import { requireRole } from '../middleware/require-role.js'
import { prisma } from '../plugins/prisma.js'
import { computeVehicleSchedule } from '../lib/maintenance-schedule.js'

const MAINTENANCE_TYPES = ['troca_oleo', 'pneu', 'freio', 'filtro', 'correia', 'revisao_geral', 'eletrica', 'outro'] as const

const PlanSchema = z.object({
  type: z.enum(MAINTENANCE_TYPES),
  intervalKm: z.number().int().min(1).optional(),
  intervalDays: z.number().int().min(1).optional(),
}).refine(d => d.intervalKm != null || d.intervalDays != null, {
  message: 'Informe um intervalo por KM e/ou por dias',
})

async function assertVehicle(tenantId: string, vehicleId: string) {
  return prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId } })
}

export const maintenancePlanRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate)
  fastify.addHook('preHandler', tenantScope)

  // Plans for a vehicle, each with its computed next-due schedule.
  fastify.get('/vehicles/:vehicleId/maintenance-plans', async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const vehicle = await assertVehicle((request as any).tenantId, vehicleId)
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })
    return computeVehicleSchedule(vehicleId, vehicle.currentKm)
  })

  fastify.post('/vehicles/:vehicleId/maintenance-plans', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(request.params)
    const vehicle = await assertVehicle((request as any).tenantId, vehicleId)
    if (!vehicle) return reply.status(404).send({ error: 'Veículo não encontrado' })

    let data: z.infer<typeof PlanSchema>
    try { data = PlanSchema.parse(request.body) }
    catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    try {
      const plan = await prisma.maintenancePlan.create({
        data: { tenantId: (request as any).tenantId, vehicleId, ...data } as any,
      })
      return reply.status(201).send(plan)
    } catch (err: any) {
      if (err?.code === 'P2002') return reply.status(409).send({ error: 'Já existe um plano para este tipo neste veículo' })
      throw err
    }
  })

  fastify.patch('/maintenance-plans/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const plan = await prisma.maintenancePlan.findFirst({ where: { id, tenantId: (request as any).tenantId } })
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' })

    const UpdateSchema = z.object({
      intervalKm: z.number().int().min(1).nullable().optional(),
      intervalDays: z.number().int().min(1).nullable().optional(),
      isActive: z.boolean().optional(),
    })
    let data: z.infer<typeof UpdateSchema>
    try {
      data = UpdateSchema.parse(request.body)
    } catch (err: any) { return reply.status(400).send({ error: err.issues ?? err.message }) }

    return prisma.maintenancePlan.update({ where: { id }, data: data as any })
  })

  fastify.delete('/maintenance-plans/:id', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const plan = await prisma.maintenancePlan.findFirst({ where: { id, tenantId: (request as any).tenantId } })
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado' })
    await prisma.maintenancePlan.delete({ where: { id } })
    return reply.status(204).send()
  })
}
