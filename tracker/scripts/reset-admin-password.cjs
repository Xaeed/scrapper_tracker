#!/usr/bin/env node
/**
 * Reset a user password (same bcrypt rounds as src/lib/auth.ts).
 *
 * Usage (from tracker/ directory, after npm install):
 *   node scripts/reset-admin-password.cjs --list
 *   node scripts/reset-admin-password.cjs <new-password>
 *   node scripts/reset-admin-password.cjs <new-password> <username>
 *
 * Loads DATABASE_URL from tracker/.env via Prisma.
 */

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const ROUNDS = 12

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--list' || args[0] === '-l') {
    const prisma = new PrismaClient()
    try {
      const users = await prisma.user.findMany({
        select: { username: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      if (users.length === 0) {
        console.log('No users yet. Open /setup in the app to create the first admin.')
        return
      }
      console.log('Users in database:')
      for (const u of users) {
        console.log(`  ${u.username}  (role: ${u.role})`)
      }
    } finally {
      await prisma.$disconnect()
    }
    return
  }

  if (args.length < 1) {
    console.error('Usage:')
    console.error('  node scripts/reset-admin-password.cjs --list')
    console.error('  node scripts/reset-admin-password.cjs <new-password> [username]')
    process.exit(1)
  }

  const newPassword = args[0]
  const username = args[1]

  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters (same rule as the app).')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const hash = await bcrypt.hash(newPassword, ROUNDS)

    let user
    if (username) {
      user = await prisma.user.findUnique({ where: { username } })
      if (!user) {
        console.error(`User not found: ${username}`)
        process.exit(1)
      }
    } else {
      user = await prisma.user.findFirst({ where: { role: 'admin' } })
      if (!user) {
        user = await prisma.user.findFirst()
      }
      if (!user) {
        console.error('No users in database. Visit /setup to create the first admin.')
        process.exit(1)
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    })
    console.log(`Password updated for: ${user.username} (role: ${user.role})`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
