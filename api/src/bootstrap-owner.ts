import 'dotenv/config';
import { prisma } from './db.js';
import { hashPassword, validPassword } from './security.js';

async function main() {
  const username = (process.env.BOOTSTRAP_OWNER_USERNAME ?? 'owner').trim().toLowerCase();
  const name = (process.env.BOOTSTRAP_OWNER_NAME ?? 'Owner').trim();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username) || !name || name.length > 150 || !validPassword(password)) {
    throw new Error('Set valid BOOTSTRAP_OWNER_USERNAME, BOOTSTRAP_OWNER_NAME and BOOTSTRAP_OWNER_PASSWORD (8–128 characters)');
  }
  const ownerCount = await prisma.user.count({ where: { role: 'OWNER' } });
  if (ownerCount > 0) throw new Error('Owner already exists; bootstrap refused');
  await prisma.user.create({ data: {
    username,
    name,
    passwordHash: await hashPassword(password),
    role: 'OWNER',
  } });
  console.log(`Owner ${username} created`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
