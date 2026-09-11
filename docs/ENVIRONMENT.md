# Environment Variables and Secrets Management

This document describes all environment variables used in the Orbit HRMS application and how to manage them securely across development, staging, and production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Development Setup](#development-setup)
4. [Staging Setup](#staging-setup)
5. [Production Setup](#production-setup)
6. [Security Best Practices](#security-best-practices)
7. [Secrets Management by Platform](#secrets-management-by-platform)
8. [Validation and Troubleshooting](#validation-and-troubleshooting)

## Quick Start

### Development (Local)

```bash
# Backend
cd api
cp .env.example .env
# Edit .env with your local database credentials
npm install
npm run dev

# Frontend (in another terminal)
cd web
cp .env.example .env.local
npm install
npm run dev
```

### Validation

Always validate your environment before starting the app:

```bash
# Backend validation
node scripts/validate-env.js

# Frontend has no validation script but uses NEXT_PUBLIC_API_URL
```

## Environment Variables Reference

### Database Configuration

#### `DATABASE_URL` (Required)
- **Format**: `postgresql://username:password@host:port/database?schema=public`
- **Purpose**: Application database connection (restricted role, no BYPASSRLS)
- **Examples**:
  - Dev: `postgresql://orbit_app:orbit_app_dev_password@localhost:5432/orbit_hr?schema=public`
  - Staging: `postgresql://orbit_app:password@staging-db.yourhost.com:5432/orbit_hr?schema=public`
  - Production: Use managed database service (Neon, AWS RDS, etc.)

#### `DIRECT_DATABASE_URL` (Required for Migrations)
- **Format**: `postgresql://username:password@host:port/database?schema=public`
- **Purpose**: Administrative database connection (used by Prisma migrations)
- **Important**: Must have DDL permissions to create tables, indexes, and roles
- **Security**: This credential should ONLY be used in CI/CD pipelines, never in application code
- **Examples**:
  - Dev: `postgresql://postgres:postgres_dev_password@localhost:5432/orbit_hr?schema=public`
  - Production: Use a dedicated migration user with minimal permissions

### Authentication & Security

#### `JWT_SECRET` (Required)
- **Minimum Length**: 32 characters (must be cryptographically secure)
- **Purpose**: Sign JWT access tokens for API authentication
- **Security**: Must be unique per environment
- **Generation**: `openssl rand -base64 32`
- **Rotation**: Can be rotated but requires careful planning (existing tokens become invalid)
- **Example**: `base64-encoded-string-of-at-least-32-chars`

#### `JWT_EXPIRES_IN` (Required)
- **Format**: Duration string (e.g., `15m`, `1h`, `7d`)
- **Default**: `15m`
- **Purpose**: Access token lifetime
- **Recommendation**: Keep short (15-30 minutes) for security; use refresh tokens for longer sessions

#### `REFRESH_TOKEN_SECRET` (Optional in Dev, Required in Production)
- **Minimum Length**: 32 characters (must be cryptographically secure)
- **Purpose**: Sign JWT refresh tokens for extending sessions
- **Security**: Must be unique and different from JWT_SECRET
- **Generation**: `openssl rand -base64 32`
- **Only in**: Staging/Production with token refresh flow

### Application Configuration

#### `NODE_ENV` (Required)
- **Allowed Values**: `development`, `staging`, `test`, `production`
- **Purpose**: Controls feature flags, logging, and error handling
- **Effect**:
  - `development`: All features enabled, verbose logging, debug module registered
  - `staging`: Production-like, but with higher debug output
  - `test`: Throttling disabled, fixtures loaded
  - `production`: Minimal logging, error messages sanitized, debug module disabled

#### `PORT` (Optional)
- **Default**: `3001`
- **Purpose**: Server listen port
- **Range**: 1-65535

#### `WEB_ORIGIN` (Optional)
- **Default**: `http://localhost:3000`
- **Format**: Full URL with scheme
- **Purpose**: CORS origin and authentication redirect origin
- **Security**: Must exactly match frontend URL or CORS will fail

### Email Configuration (Optional but Recommended)

#### `MAIL_SERVICE` (Optional)
- **Allowed Values**: `resend`, `smtp`
- **Default**: Not sending emails if not configured
- **Purpose**: Selects email provider

#### For Resend.com:

```
MAIL_SERVICE=resend
RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### For SMTP:

```
MAIL_SERVICE=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-specific-password
MAIL_FROM=noreply@orbithr.com
```

### Deployment & Public URLs

#### `APP_URL` (Optional but Recommended)
- **Format**: Full URL with scheme (https in production)
- **Purpose**: API base URL for external integrations
- **Examples**:
  - Dev: `http://localhost:3001`
  - Production: `https://api.yourdomain.com`

#### `WEB_URL` (Optional but Recommended)
- **Format**: Full URL with scheme
- **Purpose**: Frontend URL for email links, OAuth redirects, etc.
- **Examples**:
  - Dev: `http://localhost:3000`
  - Production: `https://app.yourdomain.com`

### Frontend Configuration

#### `NEXT_PUBLIC_API_URL` (Optional)
- **Default**: `http://localhost:3001/api`
- **Format**: Base API URL with `/api` suffix
- **Purpose**: Frontend API endpoint
- **Public**: Exposed to browser (prefix required)
- **Examples**:
  - Dev: `http://localhost:3001/api`
  - Production: `https://api.yourdomain.com/api`

### Debugging (Optional)

#### `DEBUG_REQUESTS` (Optional)
- **Allowed Values**: `true`, `false`
- **Default**: `false`
- **Purpose**: Log all HTTP requests in development
- **Note**: Use only in development; never enable in production

## Development Setup

### 1. Clone Repository and Install Dependencies

```bash
git clone <repository>
cd hrms

# Backend
cd api
npm install

# Frontend
cd ../web
npm install
```

### 2. Create Environment Files

**Backend:**
```bash
cd api
cp .env.example .env
```

Edit `.env` with local values:
```
DATABASE_URL=postgresql://orbit_app:orbit_app_dev_password@localhost:5432/orbit_hr?schema=public
DIRECT_DATABASE_URL=postgresql://postgres:postgres_dev_password@localhost:5432/orbit_hr?schema=public
JWT_SECRET=dev_secret_min_32_chars_long_12345
JWT_EXPIRES_IN=15m
NODE_ENV=development
PORT=3001
WEB_ORIGIN=http://localhost:3000
```

**Frontend:**
```bash
cd web
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Set Up Database

```bash
cd api

# Create database and run migrations
npx prisma migrate dev

# (Optional) Seed test data
npm run seed
```

### 4. Validate Environment

```bash
# Backend validation
node scripts/validate-env.js

# Should output:
# ✅ All environment variables are valid!
```

### 5. Start Development Servers

**Backend:**
```bash
cd api
npm run dev
# API runs on http://localhost:3001
```

**Frontend:**
```bash
cd web
npm run dev
# Frontend runs on http://localhost:3000
```

## Staging Setup

Staging should mirror production as closely as possible.

### Environment Variables

Create `.env` in both `api/` and `web/` directories:

```bash
# api/.env (staging)
DATABASE_URL=postgresql://orbit_app:STAGING_PASSWORD@staging-db.company.com:5432/orbit_hr?schema=public
DIRECT_DATABASE_URL=postgresql://postgres:STAGING_ADMIN_PASSWORD@staging-db.company.com:5432/orbit_hr?schema=public
JWT_SECRET=GENERATE_STAGING_SECRET_openssl_rand_base64_32
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=GENERATE_STAGING_REFRESH_SECRET
NODE_ENV=staging
PORT=3001
WEB_ORIGIN=https://app-staging.company.com
APP_URL=https://api-staging.company.com
WEB_URL=https://app-staging.company.com
MAIL_SERVICE=resend
RESEND_API_KEY=re_STAGING_KEY
```

```bash
# web/.env.local (staging)
NEXT_PUBLIC_API_URL=https://api-staging.company.com/api
```

### Deployment

```bash
# Using docker-compose
docker-compose -f docker-compose.staging.yml up

# Or manual deployment
cd api && npm run build
cd web && npm run build
```

## Production Setup

### Security First

Never commit actual production secrets to any repository. Use platform-specific secret management only.

### 1. Generate Secure Secrets

```bash
# Generate JWT secrets (run on secure machine)
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # REFRESH_TOKEN_SECRET
```

### 2. Set Secrets in Platform

Choose your deployment platform and follow its secret management guide:

- [Railway](#railway)
- [Fly.io](#flyio)
- [Render](#render)
- [AWS](#aws)
- [Azure](#azure)

### 3. Environment Variables Template

Use `.env.production.example` as a template:

```
DATABASE_URL=postgresql://orbit_app:PROD_PASSWORD@prod-db.yourhost.com:5432/orbit_hr?schema=public
DIRECT_DATABASE_URL=postgresql://postgres:PROD_ADMIN_PASSWORD@prod-db.yourhost.com:5432/orbit_hr?schema=public
JWT_SECRET=<GENERATED_SECURE_SECRET>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<GENERATED_SECURE_SECRET>
NODE_ENV=production
PORT=3001
WEB_ORIGIN=https://app.company.com
APP_URL=https://api.company.com
WEB_URL=https://app.company.com
MAIL_SERVICE=resend
RESEND_API_KEY=re_PRODUCTION_KEY
```

### 4. Validation

Always validate before deploying:

```bash
NODE_ENV=production node scripts/validate-env.js
```

This will:
- Check all required vars are set
- Verify no localhost/dev values in production
- Ensure secrets meet length requirements
- Warn about missing email configuration

## Security Best Practices

### 1. Never Commit Secrets

**✅ DO:**
- Commit `.env.example` with placeholder values
- Commit `.gitignore` entries for `.env`, `.env.*`
- Store real secrets in platform secret managers

**.gitignore:**
```
.env
.env.local
.env.*.local
```

**❌ DON'T:**
- Commit `.env` files with real values
- Hardcode secrets in code
- Share secrets in chat, email, or issue trackers

### 2. Secret Generation

Use cryptographically secure random generation:

```bash
# OpenSSL (most systems)
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Secret Rotation

Rotate secrets regularly in production:

1. Generate new secret
2. Set new value alongside old (if your app supports multiple keys)
3. Wait for all active tokens to expire
4. Remove old value
5. Document rotation date and reason

### 4. Access Control

- Limit who has access to production secrets
- Use role-based access (RBAC) on platform
- Audit secret access logs
- Remove access immediately when team members leave

### 5. Validation in CI/CD

Always validate environment before deployment:

```yaml
# Example GitHub Actions
- name: Validate environment
  run: NODE_ENV=production node scripts/validate-env.js
```

### 6. Different Secrets Per Environment

| Environment | JWT_SECRET | REFRESH_TOKEN_SECRET | DATABASE_CREDS |
|-------------|------------|---------------------|-----------------|
| Development | dev_secret | dev_refresh | local_dev_pass  |
| Staging     | staging_secret (generated) | staging_refresh (generated) | staging_password |
| Production  | prod_secret (generated) | prod_refresh (generated) | prod_password    |

### 7. Sensitive Information in Logs

- Never log secrets or sensitive data
- Sanitize error messages before returning to clients
- Use structured logging with proper redaction

## Secrets Management by Platform

### Railway

1. Go to your project dashboard
2. Select environment (Development, Staging, Production)
3. Click "Variables"
4. Add each environment variable
5. Set as "secret" for sensitive values

```bash
# Variables
DATABASE_URL=<value>
DIRECT_DATABASE_URL=<value>
JWT_SECRET=<value>
# ... (all others)
```

### Fly.io

1. Create secrets from command line:

```bash
flyctl secrets set JWT_SECRET=<value> DATABASE_URL=<value> ...
```

2. Or use dashboard:
   - Project Settings → Secrets
   - Add each variable

3. Verify:
```bash
flyctl secrets list
```

### Render

1. Go to your service
2. Environment → Environment Variables
3. Add variables with values
4. Mark sensitive variables as "Secret"

### AWS

1. **Secrets Manager** (recommended):

```bash
aws secretsmanager create-secret \
  --name orbit-hrms/prod/jwt-secret \
  --secret-string "your-secret-value"
```

2. **Parameter Store**:

```bash
aws ssm put-parameter \
  --name /orbit-hrms/prod/jwt-secret \
  --value "your-secret-value" \
  --type SecureString
```

3. Reference in Dockerfile or startup script:

```bash
export JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id orbit-hrms/prod/jwt-secret \
  --query SecretString --output text)
```

### Azure

1. Create Key Vault:

```bash
az keyvault create --resource-group myRG --name myKeyVault
```

2. Add secrets:

```bash
az keyvault secret set --vault-name myKeyVault \
  --name JWT-SECRET --value "your-secret-value"
```

3. Reference in Azure App Service:
   - Settings → Configuration → Application settings
   - Use @Microsoft.KeyVault(SecretUri=...) syntax

### GCP

1. Create secret:

```bash
echo -n "your-secret-value" | gcloud secrets create jwt-secret \
  --data-file=-
```

2. Grant access:

```bash
gcloud secrets add-iam-policy-binding jwt-secret \
  --member=serviceAccount:myapp@myproject.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

## Validation and Troubleshooting

### Run Validation Script

```bash
# Development
node scripts/validate-env.js

# Staging
NODE_ENV=staging node scripts/validate-env.js

# Production
NODE_ENV=production node scripts/validate-env.js
```

### Common Issues

#### DATABASE_URL Connection Failed

**Symptom**: `Error: getaddrinfo ENOTFOUND postgres`

**Causes & Solutions**:
1. Database server not running
   - Check if PostgreSQL is running locally
   - For Docker: `docker-compose up db`
2. Wrong hostname
   - Use `localhost` for local, actual hostname for remote
3. Wrong port
   - Default PostgreSQL: 5432
4. Wrong credentials
   - Verify username and password

#### JWT_SECRET Too Short

**Symptom**: `Error: JWT_SECRET: must be at least 32 characters`

**Solution**:
```bash
# Generate new secret
openssl rand -base64 32

# Update .env
JWT_SECRET=<paste-output-above>
```

#### WEB_ORIGIN CORS Error

**Symptom**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Causes & Solutions**:
1. Wrong frontend URL
   - Check if frontend is running on different port
   - Ensure WEB_ORIGIN matches exactly (including protocol/port)
2. Not set at all
   - Default is `http://localhost:3000`
   - If frontend on different port, set WEB_ORIGIN

#### NEXT_PUBLIC_API_URL Not Working

**Symptom**: Frontend cannot reach API

**Causes & Solutions**:
1. Wrong API URL
   - Ensure it includes `/api` suffix
   - Ensure it includes scheme (http:// or https://)
2. Not rebuilt after changing env
   - Next.js caches environment at build time
   - Re-run `npm run dev` or `npm run build`
3. API server not running
   - Start API server: `cd api && npm run dev`

### Environment Validation Success

```bash
$ node scripts/validate-env.js

📋 Validating environment variables for NODE_ENV=development...

✅ All environment variables are valid!
```

### Checking Current Configuration

```bash
# Backend (DON'T output actual secrets!)
grep -E '^[A-Z_]+=' api/.env | cut -d= -f1

# Frontend
grep -E '^NEXT_PUBLIC_' web/.env.local
```

## Related Documentation

- [Production Hardening Guide](./07-production-hardening.md)
- [Deployment Scripts](../scripts/)
- [Database Configuration](./05-backend.md#database)
- [Authentication & JWT](./06-auth.md)
