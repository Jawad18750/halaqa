# QuranTester Manual Deployment Instructions

## Overview
This package contains everything needed to deploy the QuranTester application to your VPS manually.

## Package Contents
- `frontend/` - Built React application (ready to serve)
- `backend/` - Node.js API server source code
- `database/` - SQL migration files
- `data/` - Quran thumun data files
- `scripts/` - Deployment helper scripts

## Prerequisites on VPS
- Node.js 20+ installed
- PostgreSQL database running
- PM2 process manager (`npm install -g pm2`)
- Web server (Nginx/Apache) for serving frontend
- SSL certificates configured

## Step-by-Step Deployment

### 1. Upload Files to VPS
```bash
# Upload the entire package to your VPS
scp -r quran-tester-deployment.zip user@your-vps:/home/user/
```

### 2. Extract and Setup on VPS
```bash
# SSH into your VPS
ssh user@your-vps

# Extract the package
unzip quran-tester-deployment.zip
cd quran-tester-deployment

# Set proper permissions
chmod +x scripts/*.sh
```

### 3. Database Setup
```bash
# Create database (if not exists)
sudo -u postgres createdb halaqa_prod

# Run migrations
cd backend
npm run migrate
```

### 4. Backend Configuration
```bash
# Install backend dependencies
cd backend
npm install --omit=dev

# Create production environment file
cat > .env << EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://username:password@localhost:5432/halaqa_prod
JWT_SECRET=your-super-secret-jwt-key-here
SMTP_USER=your-smtp-email@domain.com
SMTP_PASS=your-smtp-password
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_FROM="اختبار القرآن" <your-smtp-email@domain.com>
RESET_BASE_URL=https://halaqa.abdeljawad.com
EOF
```

### 5. Start Backend with PM2
```bash
# Start the API server
pm2 start src/index.js --name halaqa-api --cwd /path/to/backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 6. Frontend Deployment
```bash
# Copy frontend files to web server directory
sudo cp -r frontend/* /var/www/html/halaqa/

# Set proper permissions
sudo chown -R www-data:www-data /var/www/html/halaqa/
sudo chmod -R 755 /var/www/html/halaqa/
```

### 7. Web Server Configuration (Nginx Example)
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/halaqa

# Add this configuration:
server {
    listen 80;
    server_name halaqa.abdeljawad.com;
    root /var/www/html/halaqa;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable the site
sudo ln -s /etc/nginx/sites-available/halaqa /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d halaqa.abdeljawad.com -d api.halaqa.abdeljawad.com
```

### 9. Verify Deployment
```bash
# Check PM2 status
pm2 status

# Check API health
curl https://api.halaqa.abdeljawad.com/health

# Check frontend
curl https://halaqa.abdeljawad.com
```

## Environment Variables Reference

### Backend (.env)
- `NODE_ENV=production` - Environment mode
- `PORT=4000` - API server port
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `SMTP_USER` - Email username for password reset
- `SMTP_PASS` - Email password
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port (587 for TLS)
- `SMTP_FROM` - From email address
- `RESET_BASE_URL` - Base URL for password reset links

## Troubleshooting

### Common Issues
1. **Port 4000 already in use**: `sudo lsof -ti:4000 | xargs kill -9`
2. **Database connection failed**: Check DATABASE_URL format and PostgreSQL status
3. **PM2 not starting**: Check logs with `pm2 logs halaqa-api`
4. **Frontend not loading**: Check Nginx configuration and file permissions
5. **CORS errors**: Ensure API proxy is configured correctly

### Logs
```bash
# PM2 logs
pm2 logs halaqa-api

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# System logs
sudo journalctl -u nginx
```

## Security Notes
- Change default JWT_SECRET to a strong random string
- Use strong database passwords
- Keep SSL certificates updated
- Regularly update system packages
- Monitor PM2 processes and logs

## Backup Strategy
```bash
# Database backup
pg_dump halaqa_prod > backup_$(date +%Y%m%d).sql

# Application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /var/www/html/halaqa/ /path/to/backend/
```

## Updates
To update the application:
1. Upload new deployment package
2. Extract and run migrations
3. Restart PM2: `pm2 restart halaqa-api`
4. Update frontend files
5. Test the deployment

## Support
For issues or questions, check:
- PM2 logs: `pm2 logs halaqa-api`
- Database connectivity
- Web server configuration
- SSL certificate status
