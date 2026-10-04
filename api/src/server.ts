import { createApp } from './app.js';
import { prisma } from './db.js';

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGINS) {
  throw new Error('APP_ORIGINS is required in production');
}

const server = createApp(prisma).listen(port, '0.0.0.0', () => {
  console.log(`NI Fashion API listening on ${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}
process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
