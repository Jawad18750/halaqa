#!/bin/bash
# QuranTester Health Check Script
# Run this to verify your deployment is working correctly

set -e

echo "🔍 QuranTester Health Check"
echo "=========================="

# Configuration
API_URL="http://localhost:4000"
FRONTEND_URL="http://localhost"

# Check PM2 status
echo "📊 Checking PM2 status..."
if pm2 list | grep -q "halaqa-api"; then
    echo "✅ PM2 process 'halaqa-api' is running"
    pm2 list | grep halaqa-api
else
    echo "❌ PM2 process 'halaqa-api' not found"
    exit 1
fi

# Check API health endpoint
echo ""
echo "🏥 Checking API health..."
if curl -s "$API_URL/health" > /dev/null; then
    echo "✅ API health endpoint responding"
    curl -s "$API_URL/health" | jq . 2>/dev/null || curl -s "$API_URL/health"
else
    echo "❌ API health endpoint not responding"
    echo "Check PM2 logs: pm2 logs halaqa-api"
fi

# Check database connection
echo ""
echo "🗄️ Checking database connection..."
if curl -s "$API_URL/students" > /dev/null; then
    echo "✅ Database connection working"
else
    echo "❌ Database connection failed"
    echo "Check your DATABASE_URL in .env file"
fi

# Check frontend files
echo ""
echo "🌐 Checking frontend files..."
if [ -f "/var/www/html/halaqa/index.html" ]; then
    echo "✅ Frontend files present"
    ls -la /var/www/html/halaqa/ | head -5
else
    echo "❌ Frontend files not found"
    echo "Check if files were copied to /var/www/html/halaqa/"
fi

# Check ports
echo ""
echo "🔌 Checking ports..."
if netstat -tlnp | grep -q ":4000"; then
    echo "✅ Port 4000 is listening"
else
    echo "❌ Port 4000 not listening"
fi

if netstat -tlnp | grep -q ":80\|:443"; then
    echo "✅ Web server port is listening"
else
    echo "⚠️  Web server port not detected (may be using different port)"
fi

# Check disk space
echo ""
echo "💾 Checking disk space..."
df -h / | tail -1

# Check recent logs
echo ""
echo "📋 Recent PM2 logs (last 10 lines):"
pm2 logs halaqa-api --lines 10 --nostream

echo ""
echo "🏁 Health check completed!"
echo ""
echo "If any issues were found:"
echo "1. Check PM2 logs: pm2 logs halaqa-api"
echo "2. Verify .env configuration"
echo "3. Check web server configuration"
echo "4. Ensure database is running and accessible"
