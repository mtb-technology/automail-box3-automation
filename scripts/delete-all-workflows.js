#!/usr/bin/env node

/**
 * Delete ALL workflows from a FreeScout mailbox
 */

import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FREESCOUT_BASE_URL = process.env.FREESCOUT_BASE_URL || 'https://freescout.test';
const FREESCOUT_API_TOKEN = process.env.FREESCOUT_API_TOKEN || process.env.FREESCOUT_API_KEY;
const MAILBOX_ID = 3; // Box 3 mailbox

// Create axios instance with SSL verification disabled for local testing
const client = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

/**
 * Get all workflows for a mailbox
 */
async function getAllWorkflows(mailboxId) {
  try {
    console.log(`📋 Fetching all workflows for mailbox ${mailboxId}...`);

    const response = await client.get(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows`,
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN
        }
      }
    );

    // Handle FreeScout API response format
    const responseData = response.data;

    // Check if it's the nested format: { status, data: { automatic, manual } }
    if (responseData.data && responseData.data.automatic) {
      return responseData.data.automatic;
    }
    // Check if it's array format
    else if (Array.isArray(responseData)) {
      return responseData;
    }
    // Check if it's _embedded format
    else if (responseData._embedded && Array.isArray(responseData._embedded.workflows)) {
      return responseData._embedded.workflows;
    }
    // Unknown format
    else {
      console.log('Response data:', JSON.stringify(responseData, null, 2));
      return [];
    }
  } catch (error) {
    console.error(`❌ Failed to fetch workflows`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

/**
 * Delete a workflow
 */
async function deleteWorkflow(workflowId, mailboxId) {
  try {
    await client.delete(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows/${workflowId}`,
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN
        }
      }
    );

    return true;
  } catch (error) {
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Main delete function
 */
async function deleteAllWorkflows() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Delete ALL Workflows from Mailbox 3                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`🎯 Target mailbox ID: ${MAILBOX_ID}`);
    console.log(`🌐 FreeScout URL: ${FREESCOUT_BASE_URL}\n`);

    if (!FREESCOUT_API_TOKEN) {
      console.error('❌ FREESCOUT_API_TOKEN not set in .env file!');
      process.exit(1);
    }

    // Get all workflows
    const workflows = await getAllWorkflows(MAILBOX_ID);

    if (!workflows || workflows.length === 0) {
      console.log('✅ No workflows found. Mailbox is already clean.');
      return;
    }

    console.log(`\n📊 Found ${workflows.length} workflows to delete\n`);

    const results = {
      success: [],
      failed: []
    };

    // Delete each workflow
    for (const workflow of workflows) {
      console.log(`🗑️  Deleting: ${workflow.name || 'Unnamed'} (ID: ${workflow.id})...`);

      const deleted = await deleteWorkflow(workflow.id, MAILBOX_ID);

      if (deleted) {
        console.log(`   ✅ Deleted`);
        results.success.push(workflow);
      } else {
        console.log(`   ❌ Failed`);
        results.failed.push(workflow);
      }

      // Small delay between deletions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Deletion Summary                                     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successfully deleted: ${results.success.length}/${workflows.length} workflows`);

    if (results.failed.length > 0) {
      console.log(`❌ Failed to delete: ${results.failed.length} workflows\n`);
      console.log('Failed workflows:');
      results.failed.forEach((w) => {
        console.log(`   - ${w.name || 'Unnamed'} (ID: ${w.id})`);
      });
    }

    console.log('\n✨ Deletion complete!\n');

    if (results.failed.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Deletion failed:', error.message);
    process.exit(1);
  }
}

// Run deletion
deleteAllWorkflows();
