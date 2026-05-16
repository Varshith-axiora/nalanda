#!/bin/bash
# Install dependencies

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd /home/ubuntu/app/backend

echo "Installing backend dependencies..."
npm install --production

# Copy environment variables for production
# Assuming .env.production was deployed with the code
if [ -f .env.production ]; then
  echo "Copying .env.production to .env..."
  cp .env.production .env
fi
