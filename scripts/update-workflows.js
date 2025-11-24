#!/usr/bin/env node

/**
 * Update existing Box3 Workflows in FreeScout
 * Updates workflows in-place to preserve their IDs
 */

import axios from 'axios';
import https from 'https';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FREESCOUT_BASE_URL = process.env.FREESCOUT_BASE_URL || 'https://freescout.test';
const FREESCOUT_API_TOKEN = process.env.FREESCOUT_API_TOKEN || process.env.FREESCOUT_API_KEY;

// Create axios instance with SSL verification disabled for local testing
const client = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

/**
 * Get all existing workflows from FreeScout
 */
async function getExistingWorkflows(mailboxId) {
  try {
    console.log(`📋 Fetching existing workflows from mailbox ${mailboxId}...`);

    const response = await client.get(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows`,
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const workflows = response.data._embedded?.workflows || [];
    console.log(`✅ Found ${workflows.length} existing workflows\n`);
    return workflows;
  } catch (error) {
    console.error(`❌ Failed to fetch existing workflows`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

/**
 * Update a single workflow in FreeScout
 */
async function updateWorkflow(workflowId, workflowData, mailboxId) {
  try {
    console.log(`📝 Updating: ${workflowData.name} (ID: ${workflowId})`);

    const response = await client.put(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows/${workflowId}`,
      {
        name: workflowData.name,
        description: workflowData.description || '',
        type: workflowData.type,
        active: workflowData.active,
        conditions: workflowData.conditions,
        actions: workflowData.actions,
        max_executions: workflowData.max_executions || 999,
        apply_to_prev: workflowData.apply_to_prev || false
      },
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Updated workflow ID: ${workflowId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to update workflow: ${workflowData.name} (ID: ${workflowId})`);
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
    console.log('║   Box3 Workflow Update (Preserve IDs)                 ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Read workflow configuration
    const configPath = path.join(__dirname, '..', 'config', 'box3-workflows-full-lifecycle.json');
    console.log(`📖 Reading workflows from: ${configPath}`);

    if (!fs.existsSync(configPath)) {
      console.error(`❌ File not found: ${configPath}`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const mailboxId = config.mailbox_id;
    const newWorkflows = config.workflows;

    console.log(`📦 Found ${newWorkflows.length} workflows in config`);
    console.log(`🎯 Target mailbox ID: ${mailboxId}`);
    console.log(`🌐 FreeScout URL: ${FREESCOUT_BASE_URL}\n`);

    if (!FREESCOUT_API_TOKEN) {
      console.error('❌ FREESCOUT_API_TOKEN not set in .env file!');
      process.exit(1);
    }

    // Get existing workflows
    const existingWorkflows = await getExistingWorkflows(mailboxId);

    // Create a map of existing workflows by name
    const existingWorkflowMap = new Map();
    existingWorkflows.forEach(workflow => {
      existingWorkflowMap.set(workflow.name, workflow);
    });

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Updating Workflows                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const results = {
      updated: [],
      notFound: [],
      failed: []
    };

    // Update workflows one by one
    for (let i = 0; i < newWorkflows.length; i++) {
      const workflow = newWorkflows[i];
      console.log(`\n[${i + 1}/${newWorkflows.length}] Processing workflow...`);

      const existingWorkflow = existingWorkflowMap.get(workflow.name);

      if (!existingWorkflow) {
        console.log(`⚠️  Workflow not found in FreeScout: ${workflow.name}`);
        console.log(`   This workflow needs to be created with: npm run deploy`);
        results.notFound.push(workflow.name);
        continue;
      }

      try {
        await updateWorkflow(existingWorkflow.id, workflow, mailboxId);
        results.updated.push({
          name: workflow.name,
          id: existingWorkflow.id
        });

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.failed.push({
          name: workflow.name,
          id: existingWorkflow.id,
          error: error.message
        });

        // Ask if we should continue
        console.log('\n⚠️  Workflow update failed. Continue with remaining workflows? (Ctrl+C to abort)');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Update Summary                                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successfully updated: ${results.updated.length}/${newWorkflows.length} workflows`);

    if (results.updated.length > 0) {
      console.log('\n📋 Updated workflows:');
      results.updated.forEach((w, i) => {
        console.log(`   ${i + 1}. [ID: ${w.id}] ${w.name}`);
      });
    }

    if (results.notFound.length > 0) {
      console.log(`\n⚠️  Not found: ${results.notFound.length} workflows`);
      console.log('\n📋 Workflows not found in FreeScout:');
      results.notFound.forEach((name, i) => {
        console.log(`   ${i + 1}. ${name}`);
      });
      console.log('\n   Run "npm run deploy" to create these workflows.');
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length} workflows`);
      console.log('\n📋 Failed workflows:');
      results.failed.forEach((w, i) => {
        console.log(`   ${i + 1}. [ID: ${w.id}] ${w.name}`);
        console.log(`      Error: ${w.error}`);
      });
    }

    console.log('\n✨ Update complete!\n');

    if (results.failed.length > 0) {
      console.log('⚠️  Some workflows failed to update. Check the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Update failed:', error.message);
    process.exit(1);
  }
}

// Run update
updateWorkflows();
