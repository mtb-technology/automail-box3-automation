# Railway Deployment Guide

## Prerequisites

- Railway account (sign up at https://railway.app)
- Railway CLI installed (optional but recommended)
- Git repository (optional, for automatic deployments)

## Deployment Methods

### Method 1: Railway CLI (Recommended)

#### 1. Install Railway CLI

```bash
# macOS/Linux
brew install railway

# Or with npm
npm i -g @railway/cli
```

#### 2. Login to Railway

```bash
railway login
```

This will open your browser for authentication.

#### 3. Initialize Railway Project

From your project directory:

```bash
railway init
```

Select "Create new project" and give it a name like "box3-webhook-server"

#### 4. Add Environment Variables

You need to add your environment variables to Railway:

```bash
# Add variables one by one
railway variables set WEBHOOK_PORT=3000
railway variables set OPENAI_API_KEY=your_openai_api_key_here
railway variables set FREESCOUT_BASE_URL=https://freescout.test
railway variables set FREESCOUT_API_TOKEN=your_freescout_token_here
railway variables set ONYX_AI_URL=https://ai.jandebelastingman.nl/
railway variables set ONYX_AI_API_KEY=your_onyx_api_key_here
```

Or set them via the Railway dashboard:
1. Go to your project on https://railway.app
2. Click on your service
3. Go to "Variables" tab
4. Add each variable

**Important:** Update `WEBHOOK_SERVER_URL` to your Railway deployment URL after deployment (you'll get this URL after the first deploy).

#### 5. Deploy

```bash
railway up
```

This will deploy your application. Railway will:
- Detect it's a Node.js app
- Install dependencies
- Start the server using `npm start`

#### 6. Get Your Deployment URL

```bash
railway domain
```

Or generate a public domain:

```bash
railway domain --generate
```

This will give you a URL like: `https://box3-webhook-server-production.up.railway.app`

#### 7. Update Environment Variables with Deployment URL

```bash
railway variables set WEBHOOK_SERVER_URL=https://your-app-name.up.railway.app
```

Also update your `.env` file locally and in FreeScout webhook configurations with this new URL.

---

### Method 2: GitHub Integration (Automatic Deployments)

#### 1. Create GitHub Repository

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Box3 webhook server"

# Create repo on GitHub and push
git remote add origin https://github.com/yourusername/box3-webhook-server.git
git branch -M main
git push -u origin main
```

#### 2. Deploy from GitHub on Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Railway will automatically detect it's a Node.js project

#### 3. Configure Environment Variables

In the Railway dashboard:
1. Click on your deployed service
2. Go to "Variables" tab
3. Add all environment variables from your `.env` file:
   - `WEBHOOK_PORT=3000`
   - `OPENAI_API_KEY=your_key`
   - `FREESCOUT_BASE_URL=your_url`
   - `FREESCOUT_API_TOKEN=your_token`
   - `ONYX_AI_URL=your_url`
   - `ONYX_AI_API_KEY=your_key`

#### 4. Generate Domain

1. Go to "Settings" tab
2. Under "Networking" section
3. Click "Generate Domain"
4. Copy the URL

#### 5. Update WEBHOOK_SERVER_URL

Add or update the `WEBHOOK_SERVER_URL` variable in Railway with your new domain.

---

## Post-Deployment Steps

### 1. Verify Deployment

Test the health endpoint:

```bash
curl https://your-app-name.up.railway.app/health
```

You should see:

```json
{
  "status": "ok",
  "service": "FreeScout Box3 Workflow Automation",
  "timestamp": "2024-11-23T...",
  "config": {
    "openai_configured": true,
    "freescout_configured": true,
    "onyx_ai_configured": true
  }
}
```

### 2. Update FreeScout Webhooks

Update the webhook URLs in your FreeScout workflows or re-run the deployment script:

```bash
# Update the WEBHOOK_SERVER_URL in your .env
WEBHOOK_SERVER_URL=https://your-app-name.up.railway.app

# Re-deploy workflows to update webhook URLs
npm run deploy
```

### 3. Test the Webhook

```bash
curl -X POST https://your-app-name.up.railway.app/test/detect-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Ik wil graag hulp met mijn Box 3 bezwaar",
    "subject": "Box 3 vraag"
  }'
```

---

## Monitoring & Logs

### View Logs via CLI

```bash
railway logs
```

### View Logs via Dashboard

1. Go to your project on https://railway.app
2. Click on your service
3. Click "Deployments" tab
4. Click on the latest deployment
5. View logs in real-time

---

## Environment Variables Reference

Required variables for Railway:

| Variable | Description | Example |
|----------|-------------|---------|
| `WEBHOOK_PORT` | Port the server listens on | `3000` (Railway will also set PORT automatically) |
| `OPENAI_API_KEY` | OpenAI API key for AI features | `sk-...` |
| `FREESCOUT_BASE_URL` | Your FreeScout instance URL | `https://freescout.test` |
| `FREESCOUT_API_TOKEN` | FreeScout API token | `your_token_here` |
| `WEBHOOK_SERVER_URL` | Public URL of your Railway deployment | `https://your-app.up.railway.app` |
| `ONYX_AI_URL` | Onyx AI server URL (optional) | `https://ai.jandebelastingman.nl/` |
| `ONYX_AI_API_KEY` | Onyx AI API key (optional) | `your_key_here` |

**Note:** Railway automatically provides a `PORT` environment variable. The webhook server will use `PORT` if `WEBHOOK_PORT` is not set.

---

## Troubleshooting

### Deployment Fails

Check the build logs in Railway dashboard:
1. Go to "Deployments" tab
2. Click on failed deployment
3. Review error messages

Common issues:
- Missing dependencies: Ensure `package.json` is correct
- Node version: Check `engines` field in `package.json`
- Build errors: Review Railway build logs

### Server Not Starting

Check the deployment logs for errors:

```bash
railway logs
```

Common issues:
- Missing environment variables
- Port binding issues (ensure server listens on `process.env.PORT`)
- OpenAI API key invalid

### Webhooks Not Working

1. Verify the deployment URL is correct: `railway domain`
2. Check FreeScout can reach the URL (not blocked by firewall)
3. Verify webhook event names match exactly
4. Check Railway logs for incoming requests

---

## Updating Your Deployment

### Via CLI

```bash
# Make your changes locally
# Then deploy
railway up
```

### Via GitHub

Just push to your main branch:

```bash
git add .
git commit -m "Update webhook logic"
git push
```

Railway will automatically detect the push and redeploy.

---

## Cost Considerations

Railway pricing (as of 2024):
- **Free Tier**: $5 of usage per month
- **Pro Tier**: $20/month + usage

This webhook server should easily fit within the free tier for moderate usage.

Monitor your usage in the Railway dashboard under "Usage" tab.

---

## Additional Railway Configuration

### Custom Domain

If you want to use your own domain:

1. Go to "Settings" tab in Railway dashboard
2. Under "Networking"
3. Click "Custom Domain"
4. Follow instructions to add DNS records

### Health Checks

Railway automatically monitors your service. The `/health` endpoint helps Railway verify the service is running.

### Auto-Scaling

Railway will automatically handle scaling based on traffic. No additional configuration needed.

---

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`, keep it that way
2. **Use Railway's environment variables** - Don't hardcode secrets
3. **Rotate API keys regularly** - Update in Railway dashboard
4. **Enable HTTPS** - Railway provides this automatically
5. **Monitor logs** - Check for suspicious activity

---

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

## Quick Reference

```bash
# Login
railway login

# Initialize project
railway init

# Set environment variable
railway variables set KEY=value

# Deploy
railway up

# View logs
railway logs

# Get domain
railway domain

# Generate domain
railway domain --generate

# Open dashboard
railway open
```

---

**Deployment complete!** Your Box 3 webhook server is now running on Railway.
