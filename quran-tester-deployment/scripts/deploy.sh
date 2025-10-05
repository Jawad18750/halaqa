#!/bin/bash
# QuranTester Deployment Script
# Run this script on your VPS after uploading the deployment package

set -e

echo "🚀 Starting QuranTester Deployment..."

# Configuration
BACKEND_DIR="/home/deploy/halaqa-api"
FRONTEND_DIR="/var/www/html/halaqa"
DB_NAME="halaqa_prod"
DB_USER="postgres"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# Create directories
echo "📁 Creating directories..."
sudo mkdir -p "$FRONTEND_DIR"
mkdir -p "$BACKEND_DIR"

# Install Node.js dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --omit=dev

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://$DB_USER:password@localhost:5432/$DB_NAME
JWT_SECRET=$(openssl rand -base64 32)
SMTP_USER=your-smtp-email@domain.com
SMTP_PASS=your-smtp-password-here
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_FROM="اختبار القرآن" <your-smtp-email@domain.com>
RESET_BASE_URL=https://halaqa.abdeljawad.com
EOF

echo "⚠️  Please edit .env file and update DATABASE_URL and SMTP_PASS with your actual values!"

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

# Copy backend files
echo "📋 Copying backend files..."
cp -r . "$BACKEND_DIR/"

# Copy frontend files
echo "🌐 Copying frontend files..."
sudo cp -r ../frontend/* "$FRONTEND_DIR/"

# Set permissions
echo "🔐 Setting permissions..."
sudo chown -R www-data:www-data "$FRONTEND_DIR"
sudo chmod -R 755 "$FRONTEND_DIR"

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Start application with PM2
echo "🚀 Starting application with PM2..."
cd "$BACKEND_DIR"
pm2 start src/index.js --name halaqa-api --cwd "$BACKEND_DIR"
pm2 save

# Setup PM2 startup
echo "⚡ Setting up PM2 startup..."
pm2 startup

echo "✅ Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Edit $BACKEND_DIR/.env with your actual database and SMTP credentials"
echo "2. Configure your web server (Nginx/Apache) to serve frontend and proxy API"
echo "3. Setup SSL certificates"
echo "4. Test the deployment"
echo ""
echo "Useful commands:"
echo "- Check PM2 status: pm2 status"
echo "- View logs: pm2 logs halaqa-api"
echo "- Restart app: pm2 restart halaqa-api"
