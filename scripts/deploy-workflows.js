#!/usr/bin/env node

/**
 * Deploy Box3 Workflows to FreeScout
 * Reads workflows from box3-workflows-full-lifecycle.json and creates them in FreeScout
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
const WEBHOOK_SERVER_URL = process.env.WEBHOOK_SERVER_URL || 'http://localhost:3000';

// Create axios instance with SSL verification disabled for local testing
const client = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

/**
 * Extract webhook events from workflow definitions
 * Scans all workflows and finds webhook actions, then groups them by URL
 */
function extractWebhookEvents(workflows) {
  const webhookMap = new Map();

  workflows.forEach((workflow) => {
    // Check each action group
    workflow.actions?.forEach((actionGroup) => {
      actionGroup.forEach((action) => {
        if (action.type === 'webhook') {
          const eventName = action.value;

          // Determine webhook URL based on event pattern
          // All workflow.convo.* events go to /webhook/event
          let webhookUrl = `${WEBHOOK_SERVER_URL}/webhook/event`;

          // Group events by URL
          if (!webhookMap.has(webhookUrl)) {
            webhookMap.set(webhookUrl, {
              url: webhookUrl,
              events: new Set(),
              workflowNames: []
            });
          }

          const webhook = webhookMap.get(webhookUrl);
          webhook.events.add(eventName);
          webhook.workflowNames.push(workflow.name);
        }
      });
    });
  });

  // Convert Map to Array and Set to Array
  return Array.from(webhookMap.values()).map(webhook => ({
    url: webhook.url,
    events: Array.from(webhook.events),
    description: `Handles events: ${Array.from(webhook.events).join(', ')}`,
    workflows: webhook.workflowNames
  }));
}

/**
 * Register a webhook in FreeScout
 */
async function registerWebhook(webhookConfig, mailboxId) {
  try {
    console.log(`🔗 Registering webhook for events: ${webhookConfig.events.join(', ')}`);
    console.log(`   URL: ${webhookConfig.url}`);

    const response = await client.post(
      `${FREESCOUT_BASE_URL}/api/webhooks`,
      {
        url: webhookConfig.url,
        events: webhookConfig.events,
        mailboxes: [mailboxId],
        description: webhookConfig.description || ''
      },
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Webhook registered with ID: ${response.data.id || 'success'}`);
    return response.data;
  } catch (error) {
    // Check if webhook already exists (some APIs return 409 or specific error)
    if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
      console.log(`⚠️  Webhook already registered for: ${webhookConfig.events.join(', ')}`);
      return { status: 'already_exists' };
    }

    console.error(`❌ Failed to register webhook`);
    console.error(`   Events: ${webhookConfig.events.join(', ')}`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Create a single workflow in FreeScout
 */
async function createWorkflow(workflow, mailboxId) {
  try {
    console.log(`📝 Creating: ${workflow.name}`);

    const response = await client.post(
      `${FREESCOUT_BASE_URL}/api/mailbox/${mailboxId}/workflows`,
      {
        name: workflow.name,
        description: workflow.description || '',
        type: workflow.type,
        active: workflow.active,
        conditions: workflow.conditions,
        actions: workflow.actions,
        max_executions: workflow.max_executions || 999,
        apply_to_prev: workflow.apply_to_prev || false
      },
      {
        headers: {
          'X-Automail-API-Key': FREESCOUT_API_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Created workflow ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create workflow: ${workflow.name}`);
    console.error(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Main deployment function
 */
async function deployWorkflows() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Box3 Workflow Deployment to FreeScout               ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Read workflow configuration
    const configPath = '../config/box3-workflows-full-lifecycle.json';
    console.log(`📖 Reading workflows from: ${configPath}`);

    if (!fs.existsSync(configPath)) {
      console.error(`❌ File not found: ${configPath}`);
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const mailboxId = config.mailbox_id;
    const workflows = config.workflows;

    console.log(`📦 Found ${workflows.length} workflows to deploy`);
    console.log(`🎯 Target mailbox ID: ${mailboxId}`);
    console.log(`🌐 FreeScout URL: ${FREESCOUT_BASE_URL}`);
    console.log(`🔗 Webhook Server URL: ${WEBHOOK_SERVER_URL}\n`);

    if (!FREESCOUT_API_TOKEN) {
      console.error('❌ FREESCOUT_API_TOKEN not set in .env file!');
      process.exit(1);
    }

    // Step 1: Extract and register webhooks from workflows
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Step 1: Extract & Register Webhooks                 ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Dynamically extract webhook events from workflows
    const webhookEvents = extractWebhookEvents(workflows);

    if (webhookEvents.length === 0) {
      console.log('ℹ️  No webhook actions found in workflows. Skipping webhook registration.\n');
    } else {
      console.log(`📋 Found ${webhookEvents.length} unique webhook configuration(s):`);
      webhookEvents.forEach((webhook, i) => {
        console.log(`   ${i + 1}. URL: ${webhook.url}`);
        console.log(`      Events: ${webhook.events.join(', ')}`);
        console.log(`      Used by ${webhook.workflows.length} workflow(s)`);
      });
      console.log();
    }

    const webhookResults = {
      success: [],
      failed: [],
      alreadyExists: []
    };

    for (let i = 0; i < webhookEvents.length; i++) {
      const webhookConfig = webhookEvents[i];
      console.log(`\n[${i + 1}/${webhookEvents.length}] Registering webhook...`);

      try {
        const result = await registerWebhook(webhookConfig, mailboxId);

        if (result.status === 'already_exists') {
          webhookResults.alreadyExists.push({
            events: webhookConfig.events,
            url: webhookConfig.url
          });
        } else {
          webhookResults.success.push({
            events: webhookConfig.events,
            url: webhookConfig.url,
            id: result.id
          });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        webhookResults.failed.push({
          events: webhookConfig.events,
          url: webhookConfig.url,
          error: error.message
        });

        console.log('\n⚠️  Webhook registration failed. This may cause workflow webhooks to not work.');
        console.log('   Continuing with workflow deployment...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print webhook registration summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Webhook Registration Summary                         ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Newly registered: ${webhookResults.success.length}`);
    console.log(`⚠️  Already existed: ${webhookResults.alreadyExists.length}`);
    console.log(`❌ Failed: ${webhookResults.failed.length}`);

    if (webhookResults.success.length > 0) {
      console.log('\n📋 Newly registered webhooks:');
      webhookResults.success.forEach((w, i) => {
        console.log(`   ${i + 1}. Events: ${w.events.join(', ')}`);
        console.log(`      URL: ${w.url}`);
        if (w.id) console.log(`      ID: ${w.id}`);
      });
    }

    if (webhookResults.alreadyExists.length > 0) {
      console.log('\n📋 Already registered webhooks:');
      webhookResults.alreadyExists.forEach((w, i) => {
        console.log(`   ${i + 1}. Events: ${w.events.join(', ')}`);
        console.log(`      URL: ${w.url}`);
      });
    }

    if (webhookResults.failed.length > 0) {
      console.log('\n❌ Failed webhook registrations:');
      webhookResults.failed.forEach((w, i) => {
        console.log(`   ${i + 1}. Events: ${w.events.join(', ')}`);
        console.log(`      Error: ${w.error}`);
      });
    }

    // Step 2: Deploy workflows
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Step 2: Deploy Workflows                             ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    const results = {
      success: [],
      failed: []
    };

    // Deploy workflows one by one
    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows[i];
      console.log(`\n[${i + 1}/${workflows.length}] Deploying workflow...`);

      try {
        const result = await createWorkflow(workflow, mailboxId);
        results.success.push({
          name: workflow.name,
          id: result.id
        });

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.failed.push({
          name: workflow.name,
          error: error.message
        });

        // Ask if we should continue
        console.log('\n⚠️  Workflow creation failed. Continue with remaining workflows? (Ctrl+C to abort)');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Deployment Summary                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Successfully deployed: ${results.success.length}/${workflows.length} workflows`);

    if (results.success.length > 0) {
      console.log('\n📋 Created workflows:');
      results.success.forEach((w, i) => {
        console.log(`   ${i + 1}. [ID: ${w.id}] ${w.name}`);
      });
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ Failed: ${results.failed.length} workflows`);
      console.log('\n📋 Failed workflows:');
      results.failed.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.name}`);
        console.log(`      Error: ${w.error}`);
      });
    }

    console.log('\n✨ Deployment complete!\n');

    if (results.failed.length > 0) {
      console.log('⚠️  Some workflows failed. Check the errors above and try deploying them manually.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployWorkflows();
