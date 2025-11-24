#!/usr/bin/env node

/**
 * Update specific workflows in FreeScout with corrected webhook format
 * Updates only the webhook actions for workflows 1, 4, and 16
 */

import axios from 'axios';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const FREESCOUT_BASE_URL = process.env.FREESCOUT_BASE_URL || 'https://freescout.test';
const FREESCOUT_API_TOKEN = process.env.FREESCOUT_API_TOKEN;

// Create axios instance with SSL verification disabled for local testing
const client = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Workflow updates: workflow_id => new actions array
const WORKFLOW_UPDATES = {
  61: { // Workflow 1: Welcome
    name: "Box3 - 1. Welcome: New Conversation (AI-Generated)",
    webhook_value: "workflow.convo.box3.welcome.generate"
  },
  64: { // Workflow 4: Intent Detection
    name: "Box3 - 4. Detect Intent: Customer Reply (NON-attachment replies)",
    webhook_value: "workflow.convo.box3.intent.detect"
  },
  76: { // Workflow 16: AI Draft
    name: "Box3 - 16. AI Draft: Generate Reply for Agent",
    webhook_value: "workflow.convo.box3.draft.generate"
  }
};

/**
 * Delete a workflow
 */
async function deleteWorkflow(workflowId, mailboxId) {
  try {
    console.log(`🗑️  Deleting workflow ID: ${workflowId}...`);

    await client.delete(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows/${workflowId}`,
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN
        }
      }
    );

    console.log(`✅ Deleted workflow ID: ${workflowId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete workflow ${workflowId}`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Recreate a workflow with correct webhook format
 */
async function recreateWorkflow(workflowData, mailboxId) {
  try {
    console.log(`📝 Recreating: ${workflowData.name}...`);

    const response = await client.post(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows`,
      workflowData,
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Recreated workflow with new ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to recreate workflow: ${workflowData.name}`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Main update function
 */
async function updateWorkflows() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Update Webhook Format for 3 Workflows               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Read workflow configuration
    const configPath = './box3-workflows-full-lifecycle.json';
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const mailboxId = config.mailbox_id;

    console.log(`🎯 Target mailbox ID: ${mailboxId}`);
    console.log(`🌐 FreeScout URL: ${FREESCOUT_BASE_URL}\n`);

    if (!FREESCOUT_API_TOKEN) {
      console.error('❌ FREESCOUT_API_TOKEN not set in .env file!');
      process.exit(1);
    }

    // Map workflow indices to data
    const workflowsToUpdate = [
      { oldId: 61, index: 0 },  // Workflow 1
      { oldId: 64, index: 3 },  // Workflow 4
      { oldId: 76, index: 15 }  // Workflow 16
    ];

    const results = {
      success: [],
      failed: []
    };

    // Process each workflow
    for (const { oldId, index } of workflowsToUpdate) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Processing workflow ${oldId} (${config.workflows[index].name})...`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      const workflowData = config.workflows[index];

      try {
        // Delete old workflow
        const deleted = await deleteWorkflow(oldId, mailboxId);

        if (deleted) {
          // Wait a bit before recreating
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Recreate with new format
          const result = await recreateWorkflow(workflowData, mailboxId);

          results.success.push({
            name: workflowData.name,
            oldId: oldId,
            newId: result.id
          });
        } else {
          results.failed.push({
            name: workflowData.name,
            oldId: oldId,
            error: 'Failed to delete'
          });
        }

        // Small delay between workflows
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed.push({
          name: workflowData.name,
          oldId: oldId,
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Update Summary                                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successfully updated: ${results.success.length}/3 workflows`);

    if (results.success.length > 0) {
      console.log('\n📋 Updated workflows:');
      results.success.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.name}`);
        console.log(`      Old ID: ${w.oldId} → New ID: ${w.newId}`);
      });
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length} workflows`);
      console.log('\n📋 Failed workflows:');
      results.failed.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.name} (ID: ${w.oldId})`);
        console.log(`      Error: ${w.error}`);
      });
    }

    console.log('\n✨ Update complete!\n');

    if (results.failed.length > 0) {
      console.log('⚠️  Some workflows failed. Check the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Update failed:', error.message);
    process.exit(1);
  }
}

// Run update
updateWorkflows();
