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
const user = await prisma.user.update({ where: { email }, data: { passwordHash } })
console.log(`✅ Senha atualizada para ${user.email}`)
await prisma.$disconnect()
