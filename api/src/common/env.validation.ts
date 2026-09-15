/**
 * Fail fast at boot on a misconfigured environment instead of discovering it
 * on the first request (or, worse, never — e.g. running the app as the
 * privileged migration role, or signing JWTs with the value copied out of
 * .env.example). Plain function, wired into ConfigModule.forRoot({ validate }).
 */

// Placeholder secrets shipped in .env.example — never acceptable in production.
const EXAMPLE_SECRETS = new Set([
  'your_super_secure_jwt_secret_min_32_chars_here_12345',
  'your_super_secure_refresh_secret_min_32_chars_here',
]);

const ALWAYS_REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'WEB_ORIGIN'] as const;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const str = (key: string) => (typeof config[key] === 'string' ? (config[key] as string).trim() : '');
  const errors: string[] = [];

  for (const key of ALWAYS_REQUIRED) {
    if (!str(key)) errors.push(`${key} is required`);
  }
  if (str('JWT_SECRET') && str('JWT_SECRET').length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (str('NODE_ENV') === 'production') {
    if (!str('DIRECT_DATABASE_URL')) {
      errors.push('DIRECT_DATABASE_URL is required in production');
    } else if (str('DIRECT_DATABASE_URL') === str('DATABASE_URL')) {
      errors.push(
        'DIRECT_DATABASE_URL must differ from DATABASE_URL in production (the app must run as the restricted RLS role, not the migration role)',
      );
    }
    if (EXAMPLE_SECRETS.has(str('JWT_SECRET'))) {
      errors.push('JWT_SECRET is the placeholder value from .env.example');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  }
  return config;
}
