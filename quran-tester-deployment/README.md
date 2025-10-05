# QuranTester Deployment Package

## Quick Start
1. Upload this zip file to your VPS
2. Extract: `unzip quran-tester-deployment.zip`
3. Run: `cd quran-tester-deployment && chmod +x scripts/*.sh`
4. Execute: `./scripts/deploy.sh`
5. Follow the prompts to configure your environment

## Package Contents
- `frontend/` - Built React application (ready to serve)
- `backend/` - Node.js API server source code
- `database/` - SQL migration files
- `data/` - Quran thumun data files
- `scripts/` - Deployment helper scripts
- `DEPLOYMENT_INSTRUCTIONS.md` - Detailed instructions

## Prerequisites
- Node.js 20+
- PostgreSQL
- PM2 (`npm install -g pm2`)
- Web server (Nginx/Apache)

## Scripts Included
- `deploy.sh` - Main deployment script
- `health-check.sh` - Verify deployment
- `backup.sh` - Create backups

## Support
Check `DEPLOYMENT_INSTRUCTIONS.md` for detailed troubleshooting.
