import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Client generation is build-time and does not need a live database.
  datasource: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
});
