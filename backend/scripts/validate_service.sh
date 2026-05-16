#!/bin/bash
# Validate that the backend service is running and healthy

echo "Waiting for PM2 to start the application..."
sleep 5

echo "Performing health check..."
# Retry up to 5 times with a 2-second delay
for i in {1..5}; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "Failed")
  
  if [ "$HTTP_STATUS" == "200" ]; then
    echo "Health check passed! Service is returning 200 OK."
    exit 0
  fi
  
  echo "Attempt $i: Service returned $HTTP_STATUS. Retrying in 2 seconds..."
  sleep 2
done

echo "Health check failed! Service is not responding on port 5000."
# Output PM2 logs for debugging the failure
pm2 logs nalanda-backend --lines 20 --nostream
exit 1
