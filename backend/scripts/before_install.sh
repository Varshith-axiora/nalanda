#!/bin/bash
# Stop PM2 and clear old application files

# Install node/pm2 if not present (simplified for demonstration)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

pm2 stop nalanda-backend || true
pm2 delete nalanda-backend || true

# Clean up old destination if necessary
rm -rf /home/ubuntu/app/backend || true
mkdir -p /home/ubuntu/app/backend
