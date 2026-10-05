import 'dotenv/config';
import { prisma } from '../src/db.js';
import { hashPassword, validPassword } from '../src/security.js';

async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  const name = process.argv[3]?.trim();
  const password = process.argv[4];

  if (!username || !name || !password) {
    console.log('Usage: npx tsx api/scripts/create-second-owner.ts <username> <name> <password>');
    console.log('Example: npx tsx api/scripts/create-second-owner.ts owner2 "Second Owner" "securepassword123"');
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username) || !name || name.length > 150 || !validPassword(password)) {
    throw new Error('Validations: Username 3-100 chars (letters/numbers/dots/dashes). Password 8-128 chars. Name max 150 chars.');
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error(`Username ${username} is already taken.`);
  }

  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash: await hashPassword(password),
      role: 'OWNER',
    }
  });

  console.log(`Successfully created second owner with username: ${username}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
