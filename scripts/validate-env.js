#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 *
 * Validates that required environment variables are set and meet security requirements.
 * Run before application startup or in CI/CD pipelines.
 *
 * Usage:
 *   node scripts/validate-env.js
 *   NODE_ENV=staging node scripts/validate-env.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failed
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = dirname(__dirname)
const apiDir = join(projectRoot, 'api')

// Load .env file if it exists (for local development)
// Try api/.env first, then .env in project root
let envPath = join(apiDir, '.env')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
} catch {
  // Try project root .env
  envPath = join(projectRoot, '.env')
  try {
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    })
  } catch {
    // .env file not found or unreadable - use environment variables only
  }
}

const env = process.env.NODE_ENV || 'development'
const errors = []
const warnings = []

console.log(`\n📋 Validating environment variables for NODE_ENV=${env}...\n`)

/**
 * Required environment variables for all environments
 */
const requiredVars = {
  // Database
  DATABASE_URL: {
    required: true,
    validate: (value) => {
      if (!value.startsWith('postgresql://')) {
        return {
          valid: false,
          message: 'Must be a PostgreSQL connection string (postgresql://...)'
        }
      }
      if (!value.includes('@') || !value.includes(':')) {
        return {
          valid: false,
          message: 'Invalid database URL format. Expected: postgresql://user:pass@host:port/db'
        }
      }
      return { valid: true }
    }
  },

  // Authentication
  JWT_SECRET: {
    required: true,
    validate: (value) => {
      if (value.length < 32) {
        return {
          valid: false,
          message: 'JWT_SECRET must be at least 32 characters long (for security)'
        }
      }
      if (value.includes('change-me') || value.includes('dev-only')) {
        return {
          valid: false,
          message: 'JWT_SECRET must not contain default/placeholder values'
        }
      }
      return { valid: true }
    }
  },

  JWT_EXPIRES_IN: {
    required: true,
    validate: (value) => {
      if (!value.match(/^\d+[smhd]$/)) {
        return {
          valid: false,
          message: 'JWT_EXPIRES_IN must be in format: 15m, 1h, 7d, etc.'
        }
      }
      return { valid: true }
    }
  },

  REFRESH_TOKEN_SECRET: {
    required: env === 'production',
    validate: (value) => {
      if (!value) return { valid: true } // Optional in dev
      if (value.length < 32) {
        return {
          valid: false,
          message: 'REFRESH_TOKEN_SECRET must be at least 32 characters long'
        }
      }
      return { valid: true }
    }
  },

  // Application
  NODE_ENV: {
    required: true,
    validate: (value) => {
      if (!['development', 'staging', 'test', 'production'].includes(value)) {
        return {
          valid: false,
          message: 'NODE_ENV must be one of: development, staging, test, production'
        }
      }
      return { valid: true }
    }
  },

  PORT: {
    required: false,
    validate: (value) => {
      if (!value) return { valid: true } // Optional, has default
      const port = parseInt(value, 10)
      if (isNaN(port) || port < 1 || port > 65535) {
        return {
          valid: false,
          message: 'PORT must be a number between 1 and 65535'
        }
      }
      return { valid: true }
    }
  },

  WEB_ORIGIN: {
    required: false,
    validate: (value) => {
      if (!value) return { valid: true } // Optional, has default
      try {
        new URL(value)
        return { valid: true }
      } catch {
        return {
          valid: false,
          message: 'WEB_ORIGIN must be a valid URL'
        }
      }
    }
  },

  // URLs
  APP_URL: {
    required: false,
    validate: (value) => {
      if (!value) return { valid: true }
      try {
        new URL(value)
        return { valid: true }
      } catch {
        return { valid: false, message: 'APP_URL must be a valid URL' }
      }
    }
  },

  WEB_URL: {
    required: false,
    validate: (value) => {
      if (!value) return { valid: true }
      try {
        new URL(value)
        return { valid: true }
      } catch {
        return { valid: false, message: 'WEB_URL must be a valid URL' }
      }
    }
  }
}

/**
 * Validate each required variable
 */
Object.entries(requiredVars).forEach(([varName, config]) => {
  const value = process.env[varName]

  // Check if required
  if (config.required && !value) {
    errors.push(`❌ ${varName} is required but not set`)
    return
  }

  // Skip validation if not set and optional
  if (!value) {
    return
  }

  // Run custom validation
  if (config.validate) {
    const result = config.validate(value)
    if (!result.valid) {
      errors.push(`❌ ${varName}: ${result.message}`)
    }
  }
})

/**
 * Environment-specific checks
 */
if (env === 'production') {
  if (!process.env.DIRECT_DATABASE_URL) {
    errors.push('❌ DIRECT_DATABASE_URL is required in production for Prisma migrations')
  }

  // Check for insecure values in production
  const insecurePatterns = ['localhost', '127.0.0.1', 'dev', 'test']
  const prodVars = ['DATABASE_URL', 'APP_URL', 'WEB_URL']

  prodVars.forEach(varName => {
    const value = process.env[varName]
    if (value) {
      const lowerValue = value.toLowerCase()
      insecurePatterns.forEach(pattern => {
        if (lowerValue.includes(pattern)) {
          errors.push(`❌ ${varName} appears to contain a non-production value: ${value}`)
        }
      })
    }
  })

  // Warn about MAIL_SERVICE in production
  if (!process.env.RESEND_API_KEY && !process.env.MAIL_HOST) {
    warnings.push('⚠️  No email service configured. Email features will not work.')
  }
}

/**
 * Web environment variables (for use in CI/CD building web app)
 */
const webEnvFile = join(projectRoot, 'web', '.env.local')
try {
  const webEnvContent = readFileSync(webEnvFile, 'utf-8')
  if (!webEnvContent.includes('NEXT_PUBLIC_API_URL')) {
    warnings.push('⚠️  web/.env.local does not have NEXT_PUBLIC_API_URL set')
  }
} catch {
  // .env.local file not found in web - OK, might be set in build environment
}

/**
 * Report results
 */
if (errors.length > 0) {
  console.log('VALIDATION ERRORS:')
  errors.forEach(err => console.log(`  ${err}`))
  console.log()
}

if (warnings.length > 0) {
  console.log('WARNINGS:')
  warnings.forEach(warn => console.log(`  ${warn}`))
  console.log()
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All environment variables are valid!\n')
  process.exit(0)
} else if (errors.length === 0) {
  console.log('✅ Environment valid (with warnings)\n')
  process.exit(0)
} else {
  console.log('❌ Environment validation failed\n')
  process.exit(1)
}
