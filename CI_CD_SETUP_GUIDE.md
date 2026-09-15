# CI/CD Pipeline Setup Guide

## Quick Summary

A complete GitHub Actions CI/CD pipeline has been created with automated testing, building, and deployment to staging and production environments.

## Files Created

### GitHub Actions Workflows
1. **`.github/workflows/deploy.yml`** (462 lines)
   - Production deployment pipeline
   - Multi-job workflow with approval gates
   - Automatic staging deployment on master push
   - Manual production deployment with approval

2. **`.github/workflows/test.yml`** (83 lines)
   - Runs on every PR and push to any branch
   - Tests both API and web application
   - Comprehensive linting, typechecking, and test execution

### Deployment Scripts
3. **`scripts/deploy-staging.sh`** (185 lines)
   - Automates staging deployment
   - Pulls latest code, builds Docker image, starts services
   - Runs migrations and smoke tests
   - Comprehensive error handling and health checks

4. **`scripts/deploy-production.sh`** (310 lines)
   - Production deployment with multi-platform support
   - Validates environment variables
   - Supports: Railway, Fly.io, Render, Docker Host
   - Creates backups and handles failures gracefully

5. **`scripts/smoke-tests.sh`** (243 lines)
   - Post-deployment verification tests
   - Tests critical endpoints (health, auth, endpoints)
   - Verifies database connectivity and schema
   - Color-coded output with detailed reporting

### Documentation
6. **`GITHUB_SECRETS.md`** (285 lines)
   - Complete guide for GitHub Secrets configuration
   - Lists all required and optional secrets
   - Security best practices
   - Troubleshooting and testing guide

7. **`api/PHASE4_STATUS.md`** (updated)
   - Added Phase 4c CI/CD Pipeline documentation
   - Comprehensive implementation details
   - Monitoring, rollback, and troubleshooting procedures

## What Happens at Each Stage

### Development (Every Push)
1. Code pushed to any branch
2. **test.yml** workflow automatically runs
3. Tests API: lint → typecheck → build → test → e2e
4. Tests Web: lint → typecheck → build
5. All tests must pass before merge

### Merge to Master
1. Code merged to master branch
2. **deploy.yml** workflow automatically runs
3. Tests run again for final validation
4. Docker image built and tagged
5. **Automatic** deployment to staging
6. Smoke tests verify staging deployment
7. GitHub commit comment requests production review

### Production (Manual)
1. Team member manually triggers deployment
2. GitHub shows environment approval gate
3. Required reviewers approve the deployment
4. Production deployment executes
5. Smoke tests verify production deployment
6. Deployment record created in GitHub

## Setup Instructions

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

**Staging Secrets:**
- `STAGING_POSTGRES_PASSWORD` - Any secure password
- `STAGING_JWT_SECRET` - Generate with: `openssl rand -hex 32`

**Production Secrets:**
- `PRODUCTION_DATABASE_URL` - Your production database URL
- `PRODUCTION_DIRECT_DATABASE_URL` - Privileged database URL for migrations
- `PRODUCTION_JWT_SECRET` - Generate with: `openssl rand -hex 32`
- `PRODUCTION_WEB_ORIGIN` - Your production domain (e.g., https://example.com)
- `DEPLOYMENT_SERVICE` - (Optional) railway | fly | render | docker-host
- `DEPLOYMENT_TOKEN` - (Optional) API token for deployment platform

**Detailed guide**: See `GITHUB_SECRETS.md`

### 2. Configure GitHub Environments

**Staging Environment** (Optional but recommended):
1. Go to Settings → Environments → New environment
2. Name: `staging`
3. No approval required
4. Environment secrets: None needed (uses repository secrets)

**Production Environment**:
1. Go to Settings → Environments → New environment
2. Name: `production`
3. Enable "Required reviewers"
4. Add 1-2 trusted team members as reviewers
5. Deployment branches: master only (recommended)
6. Environment secrets: Add production-specific secrets if different from repo secrets

### 3. Configure Branch Protection

Optional but recommended:

1. Go to Settings → Branches → master
2. Require status checks to pass before merging:
   - api (from test.yml)
   - web (from test.yml)
3. Require code reviews: 1-2 approvals
4. Require branches to be up to date

### 4. Test the Pipeline

**Test the test.yml workflow:**
```bash
# Create a test branch
git checkout -b test/ci-pipeline

# Make a small change
echo "# Test" > test.txt
git add test.txt
git commit -m "test: ci pipeline"

# Push to GitHub
git push origin test/ci-pipeline

# Go to GitHub → Actions to watch tests run
# Create a PR and merge
```

**Test the deploy.yml workflow:**
```bash
# After merging to master, watch Actions tab
# You should see deploy.yml workflow start
# Check staging at http://localhost:3001 and http://localhost:3000
```

**Test production deployment (manual):**
```bash
# Go to GitHub → Actions → Deploy
# Click "Run workflow"
# Select environment: production
# Click "Run workflow"
# GitHub will ask for approval from required reviewers
# Once approved, deployment will execute
```

## Key Features

### Automatic Testing
- Every pull request is tested
- All branches are tested
- Tests must pass before merge to master

### Automatic Staging Deployment
- Every merge to master auto-deploys to staging
- Migrations run automatically
- Smoke tests verify deployment
- Zero downtime if implementation supports it

### Safe Production Deployment
- Manual approval required
- Multiple reviewers can approve
- Approval timeout: 30 days
- Detailed deployment logs available

### Multi-Platform Production Support
- Railway.app
- Fly.io
- Render.com
- Self-hosted Docker

## Monitoring Deployments

### In GitHub
1. Go to Actions tab
2. Click on a workflow run
3. Click on a job to see detailed logs
4. Search logs for specific messages
5. Download artifacts if needed

### After Deployment
**Staging**: Check `http://localhost:3001/api/health` and `http://localhost:3000`

**Production**: Depends on platform:
- Railway: Check Railway Dashboard
- Fly.io: Run `flyctl logs`
- Render: Check Render Dashboard
- Docker Host: Run `docker logs hrms-api`

## Troubleshooting

### Tests Failing
1. Check workflow logs: GitHub → Actions → Click failed run
2. Look for error messages in step output
3. Common issues:
   - Node version mismatch: Check .nvmrc
   - npm version: Workflow installs npm 11.17.0
   - Missing dependencies: Run `npm ci` locally

### Staging Deployment Failing
1. Check deploy-staging.sh logs
2. Verify Docker is installed and running
3. Check if ports 3000, 3001, 5432 are available
4. See PHASE4_STATUS.md for detailed troubleshooting

### Production Deployment Issues
1. Verify all GitHub Secrets are set
2. Check deployment platform credentials
3. Review platform-specific deployment logs
4. See GITHUB_SECRETS.md for troubleshooting

## Monitoring & Alerts

### GitHub Actions Notifications
- Enable notifications: GitHub Settings → Notifications
- Watch for failed workflow runs
- Check Actions tab daily

### Email Notifications
- Failed workflow emails from GitHub
- Check GitHub notification settings

### Slack Integration (Optional)
Can be configured to post deployment status to Slack channel

### Custom Monitoring
Edit `.github/workflows/deploy.yml` to add:
- Slack webhook notifications
- Email notifications
- PagerDuty alerts
- Custom logging

## Security Checklist

- [ ] All secrets added to GitHub
- [ ] Production environment requires approval
- [ ] Required reviewers assigned
- [ ] Branch protection enabled for master
- [ ] JWT_SECRET is strong (minimum 32 characters)
- [ ] Database passwords are unique and strong
- [ ] Production credentials rotated periodically
- [ ] Deployment logs reviewed for security

## Maintenance

### Weekly
- Check failed workflow runs
- Review deployment logs
- Monitor staging environment

### Monthly
- Rotate JWT secrets (invalidates tokens)
- Update Node.js Docker base image
- Review and update dependencies
- Audit GitHub Actions usage

### Quarterly
- Rotate database passwords
- Rotate deployment platform tokens
- Review and optimize workflows
- Update documentation

## Common Commands

### View logs locally
```bash
# Staging
docker-compose -f docker-compose.staging.yml logs -f

# Production (depends on platform)
# Railway
railway logs

# Fly.io
flyctl logs

# Docker Host
docker logs hrms-api
```

### Rollback Staging
```bash
# Stop current deployment
./scripts/stop-staging.sh

# Or restart with previous code
git checkout <previous-commit>
./scripts/deploy-staging.sh
```

### Rollback Production
```bash
# Depends on platform
# Railway: Use Railway Dashboard → Redeploy previous version
# Fly.io: flyctl deploy --image <previous-image-id>
# Render: Use Render Dashboard → Deploy previous version
```

## Next Steps

1. **Add GitHub Secrets** (required for deployments)
   - Follow instructions in step 1 above
   - Reference: `GITHUB_SECRETS.md`

2. **Configure GitHub Environments** (recommended)
   - Creates approval gates
   - Separates secrets by environment

3. **Test the Pipeline** (step 4 above)
   - Create test PR and verify tests run
   - Merge to master and verify staging deployment
   - Manually trigger production deployment

4. **Monitor Deployments**
   - Set up notifications
   - Watch Actions tab
   - Review deployment logs

5. **Update Documentation**
   - Add deployment procedures to wiki
   - Document team runbooks
   - Create incident response procedures

## Additional Resources

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **GitHub Secrets**: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- **GitHub Environments**: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment
- **Deployment Best Practices**: See `api/PHASE4_STATUS.md` Phase 4c section

## Support

For detailed information about:
- **CI/CD Implementation**: See `api/PHASE4_STATUS.md`
- **GitHub Secrets**: See `GITHUB_SECRETS.md`
- **Deployment Scripts**: See individual script files (well-commented)
- **Troubleshooting**: See `api/PHASE4_STATUS.md` Troubleshooting section

## Summary of Files

```
hrms/
├── .github/
│   └── workflows/
│       ├── deploy.yml          (New - Deployment pipeline)
│       ├── test.yml            (New - Test pipeline)
│       └── ci.yml              (Existing - kept as reference)
├── scripts/
│   ├── deploy-staging.sh       (New - Staging deployment)
│   ├── deploy-production.sh    (New - Production deployment)
│   └── smoke-tests.sh          (New - Deployment verification)
├── api/
│   └── PHASE4_STATUS.md        (Updated - Added Phase 4c)
├── GITHUB_SECRETS.md           (New - Secrets configuration)
└── CI_CD_SETUP_GUIDE.md        (This file)
```

---

**Created**: 2026-09-10
**Version**: 1.0
**Status**: Ready for configuration and testing
