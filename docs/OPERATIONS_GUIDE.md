# Nalanda Operations & Troubleshooting Guide

This guide contains essential commands and fixes for managing the Nalanda platform on AWS EC2.

## 1. Health Checks & Verification

### Manual Health Check
To manually verify the backend is running and responding:
```bash
curl -i http://localhost:5000/health
```
*Expected Output:* `HTTP/1.1 200 OK` and `{"status":"running"}`

### Deployment Verification
CodeDeploy automatically runs `scripts/validate_service.sh` during the `ValidateService` lifecycle hook. You can view the deployment logs directly on the EC2 instance here:
```bash
tail -f /opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log
```

---

## 2. Viewing Logs

### PM2 Logs (Backend Application)
PM2 manages the Node.js backend. To view the logs:
```bash
# View live streaming logs
pm2 logs nalanda-backend

# View the last 100 lines without streaming
pm2 logs nalanda-backend --lines 100 --nostream

# View PM2 monitoring dashboard
pm2 monit
```

### Nginx Logs (Reverse Proxy)
Nginx handles incoming internet traffic and routes it to PM2.
```bash
# View Nginx access logs (successful requests)
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs (failed requests, proxy errors)
sudo tail -f /var/log/nginx/error.log

# Verify Nginx configuration syntax
sudo nginx -t
```

---

## 3. Common Issue Fixes

### EADDRINUSE / Port Conflicts
**Symptom:** PM2 or Nginx fails to start, throwing `EADDRINUSE: address already in use :::5000` or `:::80`.
**Fix:** Find the process holding the port and terminate it.
```bash
# Find what is running on port 5000
sudo lsof -i :5000
# Kill the process (replace PID with the number from the command above)
sudo kill -9 <PID>

# If PM2 is stuck, forcefully clear it
pm2 kill
pm2 start ecosystem.config.cjs
```

### Cannot GET / (Frontend S3/CloudFront)
**Symptom:** Refreshing the page on the frontend throws a 404 error or "Cannot GET /courses".
**Fix:** This is an SPA routing issue. 
*   **S3:** Ensure both "Index document" and "Error document" are set to `index.html` in the S3 Static Hosting settings.
*   **CloudFront:** Go to your Distribution -> Error Pages -> Create Custom Error Response. Map `404 Not Found` to `/index.html` with a `200 OK` response code.

### CORS Errors
**Symptom:** Frontend console shows "Blocked by CORS policy".
**Fix:**
1. Check your `backend/.env` file. Ensure `FRONTEND_URL` exactly matches your frontend domain (e.g., `https://your-domain.com` without a trailing slash).
2. Restart PM2 so the server picks up the new environment variables:
   ```bash
   pm2 restart nalanda-backend --update-env
   ```

### ENV Variable Issues
**Symptom:** Database connections fail, or the server behaves as if it's in development mode.
**Fix:** Ensure the `.env` file exists in the `/home/ubuntu/app/backend` directory.
```bash
# Check if .env exists and view variables
cat /home/ubuntu/app/backend/.env

# Tell PM2 to reload with updated environment variables
pm2 reload nalanda-backend --update-env
```

### Aurora Connection Failures
**Symptom:** Prisma throws `PrismaClientInitializationError` or `Connection refused`.
**Fix:**
1. **Security Groups:** Ensure your Aurora RDS Security Group allows Inbound TCP port `5432` from the EC2 Instance's Security Group.
2. **URL Format:** Verify your `DATABASE_URL` in the `.env` file is perfectly formatted:
   `postgresql://USERNAME:PASSWORD@AURORA_ENDPOINT:5432/DATABASE_NAME`
3. **Subnets:** Ensure the EC2 instance is either in the same VPC or has VPC peering to the Aurora cluster. Test the connection manually:
   ```bash
   nc -zv <AURORA_ENDPOINT> 5432
   ```
