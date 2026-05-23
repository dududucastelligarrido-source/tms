import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()
const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error('Uso: tsx prisma/reset-password.ts <email> <nova-senha>')
  process.exit(1)
}

const passwordHash = await hash(newPassword)
const result = await prisma.user.updateMany({ where: { email }, data: { passwordHash } })
if (result.count === 0) { console.error('❌ Usuário não encontrado'); process.exit(1) }
console.log(`✅ Senha atualizada para ${email}`)
await prisma.$disconnect()
