#!/bin/bash
# QuranTester Backup Script
# Creates backups of database and application files

set -e

BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="halaqa_prod"
BACKEND_DIR="/home/deploy/halaqa-api"
FRONTEND_DIR="/var/www/html/halaqa"

echo "💾 Creating QuranTester Backup - $DATE"
echo "====================================="

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
echo "🗄️ Backing up database..."
pg_dump "$DB_NAME" > "$BACKUP_DIR/database_$DATE.sql"
echo "✅ Database backup: $BACKUP_DIR/database_$DATE.sql"

# Backend files backup
echo "📦 Backing up backend files..."
tar -czf "$BACKUP_DIR/backend_$DATE.tar.gz" -C "$BACKEND_DIR" .
echo "✅ Backend backup: $BACKUP_DIR/backend_$DATE.tar.gz"

# Frontend files backup
echo "🌐 Backing up frontend files..."
tar -czf "$BACKUP_DIR/frontend_$DATE.tar.gz" -C "$FRONTEND_DIR" .
echo "✅ Frontend backup: $BACKUP_DIR/frontend_$DATE.tar.gz"

# PM2 configuration backup
echo "⚙️ Backing up PM2 configuration..."
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/pm2_config_$DATE.pm2"
echo "✅ PM2 config backup: $BACKUP_DIR/pm2_config_$DATE.pm2"

# Create restore script
cat > "$BACKUP_DIR/restore_$DATE.sh" << EOF
#!/bin/bash
# Restore script for backup $DATE

set -e

echo "🔄 Restoring QuranTester from backup $DATE"

# Restore database
echo "🗄️ Restoring database..."
psql "$DB_NAME" < "$BACKUP_DIR/database_$DATE.sql"

# Restore backend
echo "📦 Restoring backend..."
tar -xzf "$BACKUP_DIR/backend_$DATE.tar.gz" -C "$BACKEND_DIR"

# Restore frontend
echo "🌐 Restoring frontend..."
tar -xzf "$BACKUP_DIR/frontend_$DATE.tar.gz" -C "$FRONTEND_DIR"

# Restore PM2 config
echo "⚙️ Restoring PM2 configuration..."
cp "$BACKUP_DIR/pm2_config_$DATE.pm2" ~/.pm2/dump.pm2
pm2 resurrect

echo "✅ Restore completed!"
EOF

chmod +x "$BACKUP_DIR/restore_$DATE.sh"

# Cleanup old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.pm2" -mtime +7 -delete
find "$BACKUP_DIR" -name "restore_*.sh" -mtime +7 -delete

echo ""
echo "✅ Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "🔄 Restore script: $BACKUP_DIR/restore_$DATE.sh"
echo ""
echo "Backup contents:"
ls -lh "$BACKUP_DIR" | grep "$DATE"
