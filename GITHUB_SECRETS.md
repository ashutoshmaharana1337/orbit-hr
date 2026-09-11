# GitHub Secrets Configuration Guide

This document outlines the secrets required for the CI/CD pipeline to function properly.

## Overview

GitHub Secrets are encrypted environment variables stored in your GitHub repository. The CI/CD workflows use these secrets to authenticate with services and configure environments.

## How to Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## Required Secrets

### Staging Environment

These secrets are used when deploying to the staging environment.

#### `STAGING_POSTGRES_PASSWORD`
- **Type:** Database Password
- **Description:** PostgreSQL password for staging database
- **Example:** `staging_password_123`
- **Security:** Should be different from production
- **Used in:** `deploy.yml` (staging deployment job)

#### `STAGING_JWT_SECRET`
- **Type:** Authentication Secret
- **Description:** JWT signing secret for staging API
- **Example:** `staging_jwt_secret_key_12345`
- **Security:** Used for signing JWT tokens, keep it secret
- **Used in:** `deploy.yml` (staging deployment job)
- **Recommendations:**
  - Minimum 32 characters
  - Mix of alphanumeric and special characters
  - Generate with: `openssl rand -hex 32`

### Production Environment

These secrets are required for production deployments. They are more restrictive and only used when manually triggering a production deployment.

#### `PRODUCTION_DATABASE_URL`
- **Type:** Connection String
- **Description:** Full PostgreSQL connection string for production
- **Example:** `postgresql://user:password@host:5432/dbname?schema=public`
- **Format:** `postgresql://[user]:[password]@[host]:[port]/[database]?schema=public`
- **Security:** Keep this secret, it contains credentials
- **Used in:** `deploy.yml` (production deployment job)
- **Notes:**
  - Should use a restricted read-only user if possible
  - Or use environment-specific credentials

#### `PRODUCTION_DIRECT_DATABASE_URL`
- **Type:** Connection String
- **Description:** Privileged PostgreSQL connection string for migrations
- **Example:** `postgresql://postgres:password@host:5432/dbname?schema=public`
- **Format:** `postgresql://[admin_user]:[password]@[host]:[port]/[database]?schema=public`
- **Security:** Only used for migrations, keep secure
- **Used in:** `deploy.yml` (production deployment job)
- **Notes:**
  - Use admin/privileged user only for migrations
  - This connection runs Prisma migrations

#### `PRODUCTION_JWT_SECRET`
- **Type:** Authentication Secret
- **Description:** JWT signing secret for production API
- **Security:** Critical - keep this very secure
- **Used in:** `deploy.yml` (production deployment job)
- **Recommendations:**
  - Minimum 64 characters
  - Cryptographically random
  - Generate with: `openssl rand -hex 32`
  - Rotate periodically (invalidates all active tokens)

#### `PRODUCTION_WEB_ORIGIN`
- **Type:** URL
- **Description:** Allowed origin for web frontend in production
- **Example:** `https://example.com`
- **Used in:** `deploy.yml` (production deployment job)
- **Notes:**
  - Used for CORS configuration
  - Include protocol (http:// or https://)
  - Production should use HTTPS only

### Deployment Platform Secrets

Choose based on your deployment platform:

#### `DEPLOYMENT_SERVICE`
- **Type:** Configuration
- **Description:** Target deployment platform
- **Options:**
  - `railway` - Deploy to Railway.app
  - `fly` - Deploy to Fly.io
  - `render` - Deploy to Render.com
  - `docker-host` - Deploy to self-hosted Docker
- **Used in:** `deploy-production.sh`
- **Example:** `railway`

#### `DEPLOYMENT_TOKEN`
- **Type:** Authentication Token
- **Description:** API token for deployment platform
- **Used in:** `deploy-production.sh` (platform-specific deployments)
- **Obtain from:**
  - **Railway:** https://railway.app/account/tokens
  - **Fly.io:** `flyctl auth token` after login
  - **Render:** https://dashboard.render.com/account/api-tokens
- **Notes:**
  - Not needed for Render if using GitHub integration
  - Not needed for Docker Host if using local/network access

## Secret Rotation

### JWT Secrets
- Plan to rotate every 30-90 days for security best practices
- Rotation invalidates all active sessions/tokens
- Schedule rotation during low-traffic periods

### Database Passwords
- Rotate on change of database operators
- Use strong passwords (minimum 16+ characters)
- Consider rotating every 6 months

### Deployment Tokens
- Check expiration dates periodically
- Rotate when access is revoked or compromised

## Testing Secrets Configuration

To verify your secrets are properly configured:

1. **Check the workflow run** in Actions tab
2. **Look for masking** - secrets should appear as `***` in logs
3. **Verify no secrets in output** - secrets should never appear in logs

## Troubleshooting

### Secrets not available in workflow
- Ensure secret is in the correct repository (not organization-level only)
- Check secret name matches exactly (case-sensitive)
- Verify the workflow has permission to access secrets

### Deployment failing with authentication error
- Verify secret values are correct and not expired
- Check that the secret name in `deploy.yml` matches the GitHub secret name
- Re-create the secret if it seems corrupted

### Database connection failing
- Verify `DATABASE_URL` and `DIRECT_DATABASE_URL` are correct
- Check database server is accessible from the deployment environment
- Verify firewall rules allow the connection

## Security Best Practices

1. **Never commit secrets to git** - Always use GitHub Secrets
2. **Use strong, random values** - Generate with cryptographic tools
3. **Limit secret access** - Only use in necessary workflows
4. **Rotate regularly** - Especially for high-impact secrets like JWT_SECRET
5. **Audit access** - Review secret usage in workflow logs
6. **Use environment-specific secrets** - Different values for staging vs production
7. **Document dependencies** - Note which secrets each workflow needs
8. **Plan for emergencies** - Keep backup values in secure location (not in git)

## Reference

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
