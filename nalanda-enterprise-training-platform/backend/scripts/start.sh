#!/bin/bash

cd /home/ubuntu/app

echo "Installing dependencies..."
npm install

echo "Starting server..."
pm2 stop server || true
pm2 start server.js --name server