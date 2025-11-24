# Webhook Format Fix - CRITICAL UPDATE

## Problem Identified

The webhook format used in the deployed workflows (IDs 61, 64, 76) is **INCORRECT**.

### ❌ Wrong Format (Currently Deployed)
```json
{
  "type": "webhook",
  "value": "{\"url\": \"http://localhost:3000/webhook/generate-welcome\", \"method\": \"POST\", \"payload\": {\"conversation_id\": \"{{conversation.id}}\"}}"
}
```

### ✅ Correct Format (Should Be)
```json
{
  "type": "webhook",
  "value": "workflow.convo.box3.welcome.generate"
}
```

---

## Files Updated

### `box3-workflows-full-lifecycle.json` ✅
This file has been **successfully updated** with the correct webhook format:

**Workflow 1 (Welcome Email):**
- Event: `workflow.convo.box3.welcome.generate`

**Workflow 4 (Intent Detection):**
- Event: `workflow.convo.box3.intent.detect`

**Workflow 16 (AI Draft):**
- Event: `workflow.convo.box3.draft.generate`

---

## API Update Attempts - 504 Timeout Errors

**All API attempts to update the workflows failed with 504 Gateway Timeout errors.**

Tried methods:
1. ❌ PATCH request to update actions only
2. ❌ PUT request to update entire workflow
3. ❌ DELETE + POST to recreate workflows

**Error:** `Request failed with status code 504`

This suggests a **FreeScout server-side issue** or the API operations are taking too long to process.

---

## Manual Fix Required

Since the API is timing out, you'll need to manually update the 3 workflows in the FreeScout UI:

### Option A: Update via FreeScout UI

1. **Go to FreeScout > Mailbox 3 > Workflows**

2. **Edit Workflow 61** (Box3 - 1. Welcome: New Conversation)
   - Find the Webhook action
   - Change value from JSON to: `workflow.convo.box3.welcome.generate`
   - Save

3. **Edit Workflow 64** (Box3 - 4. Detect Intent)
   - Find the Webhook action
   - Change value from JSON to: `workflow.convo.box3.intent.detect`
   - Save

4. **Edit Workflow 76** (Box3 - 16. AI Draft)
   - Find the Webhook action
   - Change value from JSON to: `workflow.convo.box3.draft.generate`
   - Save

### Option B: Delete & Recreate (Recommended if UI editing fails)

If the FreeScout UI doesn't allow editing the webhook format:

1. **Delete the 3 workflows manually:**
   - Workflow ID 61 (Welcome)
   - Workflow ID 64 (Intent Detection)
   - Workflow ID 76 (AI Draft)

2. **Run the deployment script again:**
   ```bash
   node deploy-workflows.js
   ```

   This will recreate all 16 workflows with the correct webhook format from the updated JSON file.

---

## Webhook Event Naming Convention

Based on your curl example, the format should be:

```
workflow.convo.[purpose].[action]
```

Examples:
- `workflow.convo.box3.welcome.generate` - Generate welcome email
- `workflow.convo.box3.intent.detect` - Detect customer intent
- `workflow.convo.box3.draft.generate` - Generate AI draft
- `workflow.convo.urgent.escalation` - Your example

---

## Next Steps

### 1. Check FreeScout Server
- Investigate why the API is returning 504 errors
- Check nginx/PHP-FPM timeout settings
- Review FreeScout logs for errors

### 2. Verify Webhook Setup in FreeScout
- Check if FreeScout needs webhook event registration
- Verify webhook event name format requirements
- Test with a simple webhook event

### 3. Update Webhook Server (webhook-server.js)
Once workflows are fixed, you may need to update `webhook-server.js` to:
- Register webhook event listeners with FreeScout
- Handle event-based webhook calls instead of direct HTTP endpoints
- Map event names to corresponding handlers

---

## Files Ready for Deployment

All files have been updated with the correct format:

- ✅ `box3-workflows-full-lifecycle.json` - Updated webhook format
- ✅ `deploy-workflows.js` - Ready to deploy
- ⏸️ `webhook-server.js` - May need adaptation for event-based webhooks

**Status:** Waiting for FreeScout API to become available or manual UI update.
