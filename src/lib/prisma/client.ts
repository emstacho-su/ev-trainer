// src/lib/prisma/client.ts
// Singleton PrismaClient with pg connection pooling
// Uses @prisma/adapter-pg for PostgreSQL native driver

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Declare global for singleton pattern in development
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Create connection pool with production-ready configuration
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({
    connectionString,
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Fail fast if can't connect in 2s
  });

  // Handle unexpected pool errors
  pool.on('error', (err: Error) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  return pool;
}

// Create PrismaClient with pg adapter
function createPrismaClient(): PrismaClient {
  const pool = createPool();
  const adapter = new PrismaPg(pool);

  const logLevels: ('query' | 'info' | 'warn' | 'error')[] =
    process.env.NODE_ENV === 'production'
      ? ['error']
      : ['query', 'error', 'warn'];

  return new PrismaClient({
    adapter,
    log: logLevels,
  });
}

// Singleton pattern with globalThis caching for hot-reload
function prismaClientSingleton(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient();
  }

  // In development, cache on globalThis to survive hot-reload
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = createPrismaClient();
  }

  return globalThis.prismaGlobal;
}

const prisma = prismaClientSingleton();

export default prisma;
