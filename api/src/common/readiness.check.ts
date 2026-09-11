/**
 * Readiness probe check for container orchestration
 *
 * This script validates that all required services are up and available
 * before marking the container as ready to receive traffic.
 *
 * Used by: Kubernetes readinessProbe, Docker Compose depends_on, CI/CD smoke tests
 */

import { PrismaClient } from '@prisma/client';

interface ReadinessCheckResult {
  ready: boolean;
  timestamp: string;
  checks: {
    database: { ok: boolean; message: string };
    environment: { ok: boolean; message: string };
  };
}

async function checkDatabase(prisma: PrismaClient): Promise<{ ok: boolean; message: string }> {
  try {
    // Attempt to connect and verify connection pool
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 5000),
      ),
    ]);

    return {
      ok: !!result,
      message: 'Database connected and responding',
    };
  } catch (error) {
    return {
      ok: false,
      message: `Database check failed: ${(error as Error).message}`,
    };
  }
}

function checkEnvironment(): { ok: boolean; message: string } {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'PORT', 'WEB_ORIGIN'];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    return {
      ok: false,
      message: `Missing required environment variables: ${missingVars.join(', ')}`,
    };
  }

  return {
    ok: true,
    message: 'All required environment variables are set',
  };
}

async function performReadinessCheck(): Promise<ReadinessCheckResult> {
  const prisma = new PrismaClient();

  try {
    const [dbCheck, envCheck] = await Promise.all([checkDatabase(prisma), Promise.resolve(checkEnvironment())]);

    const ready = dbCheck.ok && envCheck.ok;

    return {
      ready,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        environment: envCheck,
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Export for use in other modules
export { performReadinessCheck, ReadinessCheckResult };
