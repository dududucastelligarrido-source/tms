import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.tenant.findFirst({ where: { cnpj: '00000000000100' } })
  if (existing) { console.log('Seed já executado.'); return }

  const tenant = await prisma.tenant.create({
    data: { name: 'Transportadora Demo', cnpj: '00000000000100', plan: 'pro' },
  })

  const passwordHash = await hash('admin123')
  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, name: 'Admin', email: 'admin@demo.com', passwordHash, role: 'admin' },
  })

  await prisma.checklistTemplate.create({
    data: { tenantId: tenant.id, name: 'Checklist de Saída', type: 'departure', items: { create: [
      { description: 'Pneus calibrados e sem danos', isRequired: true, orderIndex: 0 },
      { description: 'Nível de óleo do motor ok', isRequired: true, orderIndex: 1 },
      { description: 'Nível de água do radiador ok', isRequired: true, orderIndex: 2 },
      { description: 'Documentos do veículo em ordem (CRLV)', isRequired: true, orderIndex: 3 },
      { description: 'Carroceria sem avarias', isRequired: false, orderIndex: 4 },
      { description: 'Extintor dentro do prazo', isRequired: true, orderIndex: 5 },
      { description: 'Lanternas e faróis funcionando', isRequired: true, orderIndex: 6 },
    ]}},
  })

  await prisma.checklistTemplate.create({
    data: { tenantId: tenant.id, name: 'Checklist de Chegada', type: 'arrival', items: { create: [
      { description: 'Veículo entregue sem avarias', isRequired: true, orderIndex: 0 },
      { description: 'Todos os custos lançados', isRequired: true, orderIndex: 1 },
      { description: 'Hodômetro fotografado', isRequired: true, orderIndex: 2 },
    ]}},
  })

  console.log(`✅ Tenant: ${tenant.name}`)
  console.log(`✅ Admin: ${admin.email} / senha: admin123`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
