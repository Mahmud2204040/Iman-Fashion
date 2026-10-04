import 'dotenv/config';
import { prisma } from './db.js';
import { hashPassword, validPassword } from './security.js';

async function main() {
  const username = (process.env.OWNER_RESET_USERNAME ?? 'owner').trim().toLowerCase();
  const password = process.env.OWNER_RESET_PASSWORD;

  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username)) {
    throw new Error('Reset refused: invalid Owner username.');
  }
  if (!validPassword(password) || password.length < 12) {
    throw new Error('Reset refused: set OWNER_RESET_PASSWORD to a new password of 12–128 characters.');
  }

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, role: true } });
  if (!user || user.role !== 'OWNER') {
    throw new Error('Reset refused: the requested account is not an Owner.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, authVersion: { increment: 1 } } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log(`Owner ${username} password reset; all sessions revoked.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message.startsWith('Reset refused:')
    ? error.message : 'Owner password reset failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
