#!/bin/bash
# Start the application using PM2

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/ubuntu/app/backend

echo "Starting PM2 application..."
pm2 start ecosystem.config.cjs --env production

# Ensure PM2 saves the current process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu || true