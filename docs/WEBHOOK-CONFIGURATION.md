# Webhook Configuration Guide

## Overview

The webhook system has been updated to support FreeScout's event-based webhook format. All three workflows (61, 64, 76) now use event names instead of JSON payloads.

---

## ✅ Completed Updates

### 1. Workflows Updated in FreeScout
- **Workflow 61:** `workflow.convo.box3.welcome.generate`
- **Workflow 64:** `workflow.convo.box3.intent.detect`
- **Workflow 76:** `workflow.convo.box3.draft.generate`

### 2. Webhook Server Updated
Added new event handler endpoint: `POST /webhook/event`

This endpoint:
- Receives all workflow events from FreeScout
- Routes events to appropriate handlers based on event name
- Handles all three Box 3 workflow events

---

## FreeScout Configuration Required

### Step 1: Configure Webhook URL in FreeScout

You need to tell FreeScout where to send webhook events. This is typically configured in:

**Option A: FreeScout Admin Settings**
1. Go to **Admin > Settings > Workflows** (or Webhooks section)
2. Set webhook URL to: `http://localhost:3000/webhook/event`
3. Enable webhook events for workflows

**Option B: Per-Workflow Configuration**
If FreeScout requires webhook URLs per workflow:
- Edit each workflow (61, 64, 76)
- Set webhook URL field to: `http://localhost:3000/webhook/event`

**Option C: Environment/Config File**
Some FreeScout installations use `.env` or config files:
```env
WORKFLOW_WEBHOOK_URL=http://localhost:3000/webhook/event
```

---

## Webhook Event Payload Format

FreeScout should send webhook events in this format:

```json
{
  "event": "workflow.convo.box3.welcome.generate",
  "conversation": {
    "id": 123,
    "subject": "Box 3 vraag",
    "user_id": 22
  },
  "customer": {
    "id": 456,
    "first_name": "Jan",
    "email": "jan@example.com"
  },
  "mailbox": {
    "id": 3,
    "name": "Box3"
  }
}
```

### Supported Event Names

| Event Name | Description | Handler |
|------------|-------------|---------|
| `workflow.convo.box3.welcome.generate` | Generate AI welcome email | `handleWelcomeGenerate()` |
| `workflow.convo.box3.intent.detect` | Detect customer intent | `handleIntentDetect()` |
| `workflow.convo.box3.draft.generate` | Generate AI draft reply | `handleDraftGenerate()` |

---

## Testing the Webhooks

### 1. Start the Webhook Server
```bash
node webhook-server.js
```

You should see:
```
╔════════════════════════════════════════════════════════╗
║   FreeScout Intent Detection Webhook Server           ║
╚════════════════════════════════════════════════════════╝

🚀 Server running on port 3000

Webhook Endpoints:
  🎯 Event Handler:    http://localhost:3000/webhook/event (handles all workflow events)
  ...
```

### 2. Test with curl

**Test Welcome Email Event:**
```bash
curl -X POST http://localhost:3000/webhook/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "workflow.convo.box3.welcome.generate",
    "conversation": {
      "id": 123
    }
  }'
```

**Test Intent Detection Event:**
```bash
curl -X POST http://localhost:3000/webhook/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "workflow.convo.box3.intent.detect",
    "conversation": {
      "id": 123
    },
    "mailbox": {
      "id": 3
    }
  }'
```

**Test Draft Generation Event:**
```bash
curl -X POST http://localhost:3000/webhook/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "workflow.convo.box3.draft.generate",
    "conversation": {
      "id": 123,
      "user_id": 22
    }
  }'
```

### 3. Test with Real Conversation

1. **Create a test email** in FreeScout mailbox 3:
   - Subject: "Box 3 vraag"
   - Body: "Ik heb een vraag over mijn Box 3 bezwaar"

2. **Watch webhook server logs** for:
   ```
   🔔 FreeScout webhook event received
   🎯 Event: workflow.convo.box3.welcome.generate
   📧 Conversation ID: 123
   👋 Handling welcome email generation...
   ✅ Welcome email sent for conversation 123
   ```

3. **Check FreeScout conversation** for:
   - AI-generated welcome email sent to customer
   - Note added: "[BOX3_FLOW] Email 1 verzonden..."

---

## Troubleshooting

### Webhooks Not Firing

**Check 1: Webhook URL Configuration**
```bash
# Test if webhook server is accessible
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "FreeScout Intent Detection Webhook",
  "timestamp": "2025-11-23T21:00:00.000Z"
}
```

**Check 2: FreeScout Workflow Logs**
- Go to FreeScout > Admin > Workflows
- View execution logs for workflows 61, 64, 76
- Look for webhook action execution status

**Check 3: Webhook Server Logs**
The webhook server logs all incoming requests:
```
🔔 FreeScout webhook event received
📦 Payload: { ... }
```

If you don't see this, FreeScout is not calling the webhook.

**Check 4: Network/Firewall**
- Ensure FreeScout can reach `http://localhost:3000`
- If FreeScout is in Docker, use host network or container IP
- Check firewall rules

### Event Not Recognized

If you see:
```
⚠️  Unknown event: some.event.name
```

The event name in the workflow doesn't match what the webhook server expects. Double-check:
1. Workflow webhook value (should be exact event name)
2. Event name in webhook server switch statement

### API Errors

If webhook handler fails:
```
❌ FreeScout API error: ...
```

Check:
- `FREESCOUT_BASE_URL` in `.env` (should be `https://freescout.test`)
- `FREESCOUT_API_TOKEN` in `.env` (should be `589f459ed135d3fdf93fc9899b6b6bf8`)
- FreeScout API token permissions (needs conversation read/write)

---

## Production Deployment

### Use HTTPS and Domain

For production, update webhook URL to use HTTPS:

1. **Get a domain/subdomain:**
   - Example: `webhooks.yourdomain.com`

2. **Set up reverse proxy (nginx):**
   ```nginx
   server {
       listen 443 ssl;
       server_name webhooks.yourdomain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **Update FreeScout webhook URL:**
   - Change from: `http://localhost:3000/webhook/event`
   - To: `https://webhooks.yourdomain.com/webhook/event`

### Use Process Manager (PM2)

Keep webhook server running:

```bash
# Install PM2
npm install -g pm2

# Start webhook server with PM2
pm2 start webhook-server.js --name box3-webhooks

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### Monitor Logs

```bash
# View real-time logs
pm2 logs box3-webhooks

# View last 100 lines
pm2 logs box3-webhooks --lines 100
```

---

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  Customer sends email to FreeScout                  │
│  Subject: "Box 3 vraag"                             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  FreeScout Workflow 61 triggers                     │
│  Condition: Subject matches "(box ?3|vermogen)"     │
│             AND New conversation                     │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Workflow Action: Webhook                           │
│  Event: "workflow.convo.box3.welcome.generate"      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  POST http://localhost:3000/webhook/event           │
│  {                                                   │
│    "event": "workflow.convo.box3.welcome.generate", │
│    "conversation": { "id": 123 }                    │
│  }                                                   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Webhook Server Routes Event                        │
│  → handleWelcomeGenerate(conversationId)            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  1. Fetch conversation details from FreeScout       │
│  2. Extract customer's initial message              │
│  3. Generate personalized welcome email with AI     │
│  4. Send email via FreeScout API                    │
│  5. Add note to conversation                        │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  Customer receives personalized welcome email       │
│  Status: Active                                      │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Workflows updated with correct event format
2. ✅ Webhook server updated with event handler
3. ⏳ **Configure webhook URL in FreeScout** (your action needed)
4. ⏳ **Test with a real conversation** (your action needed)
5. ⏳ **Deploy to production** (when ready)

---

## Summary

**What was changed:**
- Workflows 61, 64, 76 now use event names instead of JSON webhook format
- `webhook-server.js` now has `/webhook/event` endpoint that routes events
- Three event handlers: welcome, intent detect, draft generate

**What you need to do:**
- Configure webhook URL in FreeScout to point to `http://localhost:3000/webhook/event`
- Test the workflows with a real conversation
- Monitor logs to ensure webhooks are firing correctly

**Files updated:**
- ✅ `box3-workflows-full-lifecycle.json`
- ✅ `webhook-server.js`
- ✅ Workflows 61, 64, 76 in FreeScout (via API)
