#!/usr/bin/env node

/**
 * Box3 Workflow Automation - Webhook Server
 *
 * AI-powered webhook server for FreeScout Box 3 tax advisory workflows.
 *
 * Features:
 * - Event-based webhook routing (single /webhook/event endpoint)
 * - AI-powered intent detection using OpenAI GPT-4o-mini
 * - Personalized welcome email generation
 * - Agent-specific AI draft replies (6 specialized agents)
 * - RAG integration with Onyx AI for Intake Agent
 * - Payment confirmation handling
 *
 * Endpoints:
 * - POST /webhook/event - Main event router (handles all workflow events)
 * - POST /webhook/signed-and-paid - Payment confirmation from external system
 * - GET /health - Health check
 * - POST /test/detect-intent - Test intent detection
 */

import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' })); // Increase payload size limit for large conversations

const CONFIG = {
  port: process.env.WEBHOOK_PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  freescoutUrl: process.env.FREESCOUT_BASE_URL || 'https://freescout.test',
  freescoutApiKey: process.env.FREESCOUT_API_TOKEN,
  onyxAiUrl: process.env.ONYX_AI_URL || 'http://localhost:8080',
  onyxAiApiKey: process.env.ONYX_AI_API_KEY,
};

/**
 * Custom Field Mapping for Mailbox 3 (Box 3 service)
 * Maps FreeScout custom field IDs to their names for easy access
 *
 * Retrieved from FreeScout API on 2025-11-26:
 * ID 9  → Form ID
 * ID 10 → Active Step
 * ID 11 → WOZ Value
 * ID 12 → Mortgage Value
 * ID 13 → Savings Value
 * ID 14 → Investment Value
 * ID 15 → Assets Value
 * ID 16 → Debts Value
 * ID 17 → Estimate 1
 * ID 18 → Estimate 2
 * ID 19 → Final Estimate
 * ID 22 → Years Selected (multi-select)
 * ID 23 → Has Objected (boolean)
 * ID 24 → Final Imposed Objected (boolean)
 * ID 25 → Has Second Property (boolean)
 * ID 26 → Second Property Abroad (boolean)
 * ID 27 → Restore Link
 */
const CUSTOM_FIELD_MAP = {
  // Internal tracking
  FORM_ID: 9,
  ACTIVE_STEP: 10,

  // Financial data
  WOZ_VALUE: 11,
  MORTGAGE_VALUE: 12,
  SAVINGS_VALUE: 13,
  INVESTMENT_VALUE: 14,
  ASSETS_VALUE: 15,
  DEBTS_VALUE: 16,

  // Estimates
  ESTIMATE_1: 17,
  ESTIMATE_2: 18,
  FINAL_ESTIMATE: 19,

  // Additional form fields
  YEARS_SELECTED: 22,              // Multi-select: years
  HAS_OBJECTED: 23,                // Boolean: has customer objected before
  FINAL_IMPOSED_OBJECTED: 24,      // Boolean: final assessment imposed and objected
  HAS_SECOND_PROPERTY: 25,         // Boolean: has second property
  SECOND_PROPERTY_ABROAD: 26,      // Boolean: second property is abroad
  RESTORE_LINK: 27,                // Link to restore/resume form

  // Future field - add this to FreeScout if you want service-specific prompts
  SERVICE_NAME: null // TODO: Create this custom field in FreeScout (e.g., "Box 3 Bezwaar", "Tax Analysis", "Business Tax")
};

/**
 * Service-specific context for AI prompts
 * Maps service names to additional context that should be included in prompts
 */
const SERVICE_CONTEXT_MAP = {
  'Box 3 Bezwaar': {
    focus: 'Box 3 vermogensbelasting bezwaar',
    keywords: ['Box 3', 'vermogensrendementsheffing', 'bezwaar', 'aangifte'],
    additionalContext: 'Focus on Box 3 wealth tax objection process and timeline'
  },
  'Tax Analysis': {
    focus: 'General tax analysis and advice',
    keywords: ['belasting', 'analyse', 'advies'],
    additionalContext: 'Provide general tax advice and analysis'
  },
  'Business Tax': {
    focus: 'Business tax matters (BTW, VPB, etc.)',
    keywords: ['onderneming', 'BTW', 'vennootschapsbelasting'],
    additionalContext: 'Focus on business tax matters including VAT and corporate income tax'
  },
  'Default': {
    focus: 'General tax advisory service',
    keywords: ['belasting', 'advies'],
    additionalContext: 'Provide helpful tax advisory services'
  }
};

/**
 * Helper function to get custom field value from conversation
 */
function getCustomFieldValue(conversation, fieldId) {
  if (!conversation.customFields || !fieldId) return null;

  const field = conversation.customFields.find(f => f.id === fieldId);
  return field ? field.value : null;
}

/**
 * Helper function to get service context for AI prompts
 */
function getServiceContext(conversation) {
  const serviceName = getCustomFieldValue(conversation, CUSTOM_FIELD_MAP.SERVICE_NAME);

  // If SERVICE_NAME field exists and has a value, use it
  if (serviceName && SERVICE_CONTEXT_MAP[serviceName]) {
    return SERVICE_CONTEXT_MAP[serviceName];
  }

  // Otherwise, default to Box 3 Bezwaar (since mailbox 3 is for Box 3)
  return SERVICE_CONTEXT_MAP['Box 3 Bezwaar'];
}

/**
 * Helper function to format custom fields for AI prompts
 * Returns a formatted string with all non-empty custom field values
 * Excludes internal tracking fields (Form ID, Active Step)
 */
function formatCustomFieldsForPrompt(conversation) {
  if (!conversation.customFields || conversation.customFields.length === 0) {
    return '';
  }

  // Fields to exclude from AI prompts (internal tracking only)
  const excludedFieldIds = [
    CUSTOM_FIELD_MAP.FORM_ID,      // Form ID - internal tracking
    CUSTOM_FIELD_MAP.ACTIVE_STEP,  // Active Step - internal workflow state
    CUSTOM_FIELD_MAP.RESTORE_LINK
  ];

  const nonEmptyFields = conversation.customFields
    .filter(field => field.value && field.value.trim() !== '')
    .filter(field => !excludedFieldIds.includes(field.id))
    .map(field => `- ${field.name}: ${field.value}`)
    .join('\n');

  if (nonEmptyFields.length === 0) {
    return '';
  }

  return `\n\n=== CUSTOMER DATA (Custom Fields) ===\n${nonEmptyFields}\n=== END OF CUSTOMER DATA ===`;
}

/**
 * Agent definitions and their specialized AI prompts
 * Only includes agents actively used in the Box3 workflows
 */
const AGENTS = {
  22: {
    name: 'Intake Agent',
    prompt: `You are the Intake Agent for Jan de Belastingman - Box 3 service.

Your role: Gather all required information to create an accurate quote. You have access to internal company documents and knowledge base to answer customer questions accurately.

What you need to collect (based on service type):
**For Box 3 Bezwaar:**
- Have they received final assessment? When?
- Was objection filed within 6 weeks?
- What is their wealth amount (ballpark)?

**For Tax Analysis:**
- Tax issue/question
- Relevant tax years
- Special circumstances (foreign income, property, etc.)

**For Business Tax:**
- Industry
- Annual revenue (estimate)
- Transaction volume

Guidelines:
- Be systematic but friendly
- Ask for missing information clearly
- When answering questions, use information from our internal documents if provided
- Reference company policies and procedures accurately
- Explain why you need information (helps with accurate quote)
- If they provided partial info, acknowledge what you have
- If dossier is complete, say: "Bedankt! We hebben alle informatie. U ontvangt binnenkort een voorstel."
- Use HTML formatting for clarity where appropriate (<p>, <strong>, <ul>, <li>, etc.)

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Write in Dutch unless customer wrote in English.`
  },
  23: {
    name: 'Quote Agent',
    prompt: `You are the Quote Agent for Jan de Belastingman - Box 3 service.

Your role: Create professional quotes with tiered pricing options.

Pricing guidance:
- Simple cases: €250-400 (Tier 1)
- Medium complexity: €350-550 (Tier 1)
- Complex cases: €500-750 (Tier 1)
- Tier 2 adds specialist consultation: +€100
- Tier 3 (Full service): €550-2000+

Guidelines:
- Present 3 clear options (Analysis, Analysis+Consult, Full Service)
- Explain what each tier includes
- Highlight value proposition
- Make it easy to say yes
- Address any questions they have about options
- If they're comparing, emphasize our expertise
- Use HTML formatting for clarity where appropriate (<p>, <strong>, <ul>, <li>, etc.)

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Write in Dutch unless customer wrote in English.`
  },
  26: {
    name: 'Payment Agent',
    prompt: `You are the Payment Agent for Jan de Belastingman - Box 3 service.

Your role: Process payments via Moneybird (payment links for private, invoices for business).

Guidelines:
- If customer accepted quote, thank them and explain payment process
- Private customers: "U ontvangt zo een betaallink via e-mail"
- Business customers: "We sturen u een factuur voor het afgesproken bedrag"
- If they confirm payment, acknowledge and explain next steps
- Be clear about what happens after payment
- If questions about payment methods, explain options
- Use HTML formatting for clarity where appropriate (<p>, <strong>, <ul>, <li>, etc.)

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Write in Dutch unless customer wrote in English.`
  }
};

// Fallback prompt for unknown agents
const DEFAULT_AGENT_PROMPT = `You are a helpful assistant for Jan de Belastingman - Box 3 tax advisory service.

Guidelines:
- Be professional, friendly, and helpful
- Write in Dutch unless customer wrote in English
- Keep it concise (2-4 paragraphs)
- Address customer questions clearly
- Use HTML formatting for clarity where appropriate (<p>, <strong>, <ul>, <li>, etc.)

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Respond with ONLY the email body, no subject line.`;

/**
 * Query Onyx AI for relevant context from embedded documents
 */
async function queryOnyxAI(question) {
  try {
    console.log(`🔍 Querying Onyx AI for context: "${question.substring(0, 100)}..."`);

    const response = await axios.post(
      `${CONFIG.onyxAiUrl}/api/chat`,
      {
        query: question,
        // Adjust these parameters based on your Onyx AI setup
        collection: 'box3-documents', // Your document collection name
        top_k: 3, // Number of relevant documents to retrieve
        include_sources: true
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.onyxAiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const context = response.data.answer || response.data.context || '';
    const sources = response.data.sources || [];

    console.log(`✅ Onyx AI returned context (${context.length} chars) from ${sources.length} sources`);

    return {
      context,
      sources
    };
  } catch (error) {
    console.error('⚠️  Onyx AI query failed:', error.response?.data || error.message);
    console.log('⚠️  Falling back to OpenAI without document context');
    return {
      context: '',
      sources: []
    };
  }
}

/**
 * Analyze conversation using OpenAI to detect intent
 */
async function detectIntentWithOpenAI(conversationText, subject) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that analyzes customer emails for a Dutch tax advisory firm (Box 3 bezwaar service).

Your task is to detect the customer's intent from their email.

Available intents:
- Nieuwe_Aanvraag: New inquiry, first contact, asking about services
- Klant_Wil_Doorgaan: Customer accepts proposal, wants to proceed, agrees to pricing
- Klant_Weigert: Customer declines service, not interested, too expensive, "ik wil niet verder"
- Payment_Confirmed: Customer confirms payment was made (keywords: betaald, betaling, paid, overgemaakt)
- DOCS_RECEIVED: Customer uploaded documents (detected by attachment presence)
- Proposal_Accepted: Customer accepts a specific proposal option (akkoord, accept, ga ermee akkoord)
- QUESTIONS_ANSWERED: Customer answered additional questions from Email 3
- Additional_Info: Customer is providing additional information
- CLOSED_LOST: Customer explicitly states they don't want to continue
- Question: Customer has questions about the process or service

Respond with ONLY the intent name, nothing else.`
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nEmail content:\n${conversationText}\n\nWhat is the customer's intent?`
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const intent = response.data.choices[0].message.content.trim();
    console.log(`✅ OpenAI detected intent: ${intent}`);
    return intent;
  } catch (error) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get conversation details from FreeScout
 */
async function getConversation(conversationId) {
  try {
    const response = await axios.get(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}?embed=threads`,
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ FreeScout API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update conversation tags in FreeScout (appends to existing tags)
 */
async function updateConversationTags(conversationId, newTags) {
  try {
    // First, fetch existing tags using the tags endpoint
    const getResponse = await axios.get(
      `${CONFIG.freescoutUrl}/api/tags`,
      {
        params: {
          conversationId: conversationId,
          page: 1,
          pageSize: 100
        },
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    // Extract tag names from _embedded.tags array of objects
    const tagObjects = getResponse.data._embedded?.tags || [];
    const existingTags = tagObjects.map(tag => tag.name);

    // Merge existing tags with new tags (remove duplicates)
    const allTags = [...new Set([...existingTags, ...newTags])];

    // Update with merged tags
    const response = await axios.put(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/tags`,
      { tags: allTags },
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Tags updated for conversation ${conversationId}`);
    console.log(`   Previous: [${existingTags.join(', ')}]`);
    console.log(`   Added: [${newTags.join(', ')}]`);
    console.log(`   Current: [${allTags.join(', ')}]`);

    return response.data;
  } catch (error) {
    console.error('❌ Failed to update tags:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add note to conversation
 */
async function addNote(conversationId, noteText) {
  try {
    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      {
        type: 'note',
        text: noteText,  // FreeScout uses "text" not "body"
        user: 1          // System user
      },
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Note added to conversation ${conversationId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to add note:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Add line item (timeline event) to conversation
 */
async function addLineItem(conversationId, actionText) {
  try {
    const requestBody = {
      type: 'lineitem',
      user: 1,           // System user
      action_type: 100,  // Custom action type
      source_type: 3,    // API
      source_via: 2      // USER
    };

    // Add custom action text via meta if provided
    if (actionText) {
      requestBody.meta = { custom_action_text: actionText };
    }

    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      requestBody,
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Line item added to conversation ${conversationId}: ${actionText}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to add line item:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FreeScout Box3 Workflow Automation',
    timestamp: new Date().toISOString(),
    config: {
      openai_configured: !!CONFIG.openaiApiKey,
      freescout_configured: !!CONFIG.freescoutApiKey,
      onyx_ai_configured: !!CONFIG.onyxAiApiKey
    }
  });
});

/**
 * Generate AI draft reply for agent using agent-specific prompt
 */
async function generateDraftReply(conversationHistory, subject, assignedUserId, language = 'nl', serviceContext = null, conversation = null) {
  try {
    // Get agent-specific prompt or use default
    const agentConfig = AGENTS[assignedUserId];
    const agentPrompt = agentConfig ? agentConfig.prompt : DEFAULT_AGENT_PROMPT;
    const agentName = agentConfig ? agentConfig.name : 'General Agent';

    console.log(`📝 Using ${agentName} prompt (User ID: ${assignedUserId}), Language: ${language}`);
    if (serviceContext) {
      console.log(`   Service focus: ${serviceContext.focus}`);
    }

    // Add custom fields to prompt if available
    let customFieldsContext = '';
    if (conversation) {
      customFieldsContext = formatCustomFieldsForPrompt(conversation);
    }

    // Map FreeScout language codes to full names
    const languageMap = {
      'nl': 'Dutch',
      'en': 'English',
      'de': 'German',
      'fr': 'French'
    };
    const languageName = languageMap[language] || 'Dutch';

    // For Intake Agent (ID 22), query Onyx AI for document context
    let additionalContext = '';
    let sources = [];

    if (assignedUserId === 22 && CONFIG.onyxAiApiKey) {
      console.log(`🔍 Intake Agent detected - querying Onyx AI for document context...`);

      // Extract the latest customer message as the query
      const customerQuery = conversationHistory.split('\n\n').pop() || conversationHistory;

      const onyxResult = await queryOnyxAI(customerQuery);

      if (onyxResult.context) {
        additionalContext = `\n\n=== RELEVANT INFORMATION FROM INTERNAL DOCUMENTS ===\n${onyxResult.context}\n=== END OF DOCUMENT CONTEXT ===\n\nUse the above information from our internal documents to help answer the customer's questions. If the documents contain relevant information, reference it in your response.`;
        sources = onyxResult.sources;
      }
    }

    // Add service-specific context if available
    let servicePromptAddition = '';
    if (serviceContext && serviceContext.focus !== 'Box 3 vermogensbelasting bezwaar') {
      servicePromptAddition = `\n\n=== SERVICE CONTEXT ===\nThis conversation is about: ${serviceContext.focus}\n${serviceContext.additionalContext}\n=== END OF SERVICE CONTEXT ===`;
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: agentPrompt
          },
          {
            role: 'user',
            content: `Language: ${languageName}
Subject: ${subject}

Conversation history:
${conversationHistory}${additionalContext}${servicePromptAddition}${customFieldsContext}

Generate a draft reply in ${languageName} for the agent to review and send. Use any relevant custom field data provided above to personalize the response.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const draftReply = response.data.choices[0].message.content.trim();
    console.log(`✅ OpenAI generated draft reply (${draftReply.length} chars) for ${agentName}`);

    if (sources.length > 0) {
      console.log(`📚 Used context from ${sources.length} Onyx AI document sources`);
    }

    return draftReply;
  } catch (error) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Create draft reply thread in FreeScout
 */
async function createDraftReply(conversationId, draftText, assignedUserId) {
  try {
    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      {
        type: 'message',  // Use 'message' not 'reply'
        text: draftText,  // FreeScout uses "text" not "body"
        user: assignedUserId || 1,
        state: 'draft'    // Use 'state' not 'status' for draft
      },
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Draft reply created for conversation ${conversationId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create draft:', error.response?.data || error.message);
    throw error;
  }
}


/**
 * Generate AI welcome email based on customer's initial message
 */
async function generateWelcomeEmail(customerMessage, subject, customerName, language = 'nl', serviceContext = null, conversation = null) {
  try {
    console.log(`📝 Generating personalized welcome email for ${customerName} in language: ${language}...`);
    if (serviceContext) {
      console.log(`   Service focus: ${serviceContext.focus}`);
    }

    // Map FreeScout language codes to full names
    const languageMap = {
      'nl': 'Dutch',
      'en': 'English',
      'de': 'German',
      'fr': 'French'
    };
    const languageName = languageMap[language] || 'Dutch';

    // Build service-specific context for the prompt
    let servicePromptAddition = '';
    if (serviceContext && serviceContext.focus !== 'Box 3 vermogensbelasting bezwaar') {
      servicePromptAddition = `\n\n**Service Context:**\nThis customer is inquiring about: ${serviceContext.focus}\n${serviceContext.additionalContext}`;
    }

    // Add custom fields to prompt if available
    let customFieldsContext = '';
    if (conversation) {
      customFieldsContext = formatCustomFieldsForPrompt(conversation);
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the Welcome Agent for Jan de Belastingman - Box 3 bezwaar service.

Your role: Create a warm, personalized welcome email following a specific structure that acknowledges the customer's situation and explains the process.

**Email Structure - FOLLOW THIS TEMPLATE:**

1. **Personal Greeting** (1-2 sentences)
   - Address customer by full name (use formal format if available: "Beste [Initials]. [Last Name]")
   - Thank them for their registration
   - Reference their specific situation based on available data (wealth mix with savings and investments, WOZ value, investment portfolio, etc.)
   - Show understanding that they want to know if they qualify for tax refund based on actual returns

2. **Why This Approach?** (1 paragraph)
   - Explain the legal complexity of Box 3 (difference between forfaitaire rendement and werkelijk rendement)
   - Emphasize structured process provides certainty upfront
   - Prevent starting expensive legal process if it yields nothing
   - "Eerst rekenen, dan pas beslissen" (Calculate first, then decide)

3. **The 5 Steps** (ordered list)
   Present exactly these 5 steps as <ol>:
   - **Aanleveren gegevens**: Customer receives email with list of required documents
   - **Analyse**: Calculate hard numerical difference between tax assessment and actual returns
   - **Voorstel**: Customer receives personal advisory report with expected result (potential refund)
   - **Akkoord**: If favorable, finalize agreements after customer approval
   - **Indiening**: Submit motivated objection to Belastingdienst

4. **Call to Action** (1 sentence)
   - "Houd uw inbox in de gaten: de e-mail met het concrete informatieverzoek volgt over enkele minuten."

**Personalization Guidelines:**
- Reference specific financial data if available (WOZ value, savings amounts, investment values, estimates)
- Mention "vermogensmix (spaargeld en beleggingen)" if both SAVINGS_VALUE and INVESTMENT_VALUE are present
- If years_selected is provided, mention the specific years
- If has_objected is true, acknowledge they've been through this before
- If has_second_property is true, acknowledge multiple properties
- Keep personalization natural and conversational

**Formatting:**
- Use HTML: <p>, <strong>, <ol>, <li>
- Use <strong> for emphasis on key phrases
- Structure the 5 steps as an ordered list with <ol> and <li> tags

**Tone:**
- Professional but warm
- Confident and reassuring
- Show expertise in Box 3 matters
- Empathetic to their situation
- No jargon unless explained

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Respond with ONLY the email body (no subject line).`
          },
          {
            role: 'user',
            content: `Customer name: ${customerName}
Language: ${languageName}
Subject: ${subject}

Customer's initial message:
${customerMessage}${servicePromptAddition}${customFieldsContext}

Generate a personalized welcome email in ${languageName} that acknowledges their specific situation and uses any relevant custom field data provided above.`
          }
        ],
        temperature: 0.7,
        max_tokens: 600
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const welcomeEmail = response.data.choices[0].message.content.trim();
    console.log(`✅ OpenAI generated personalized welcome email (${welcomeEmail.length} chars)`);

    return welcomeEmail;
  } catch (error) {
    console.error('❌ OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send email to customer via FreeScout
 */
async function sendEmailToCustomer(conversationId, subject, body, scheduledAt = null) {
  try {
    const requestBody = {
      type: 'message',
      text: body,  // FreeScout uses "text" not "body"
      user: 1      // System user
    };

    // Add scheduledAt if provided
    if (scheduledAt) {
      requestBody.scheduledAt = scheduledAt;
    }

    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      requestBody,
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    if (scheduledAt) {
      console.log(`✅ Email scheduled for ${new Date(scheduledAt).toLocaleString()} in conversation ${conversationId}`);
    } else {
      console.log(`✅ Email sent to customer in conversation ${conversationId}`);
    }
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send email:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Calculate scheduled datetime in ISO 8601 format
 */
function calculateScheduledDateTime(delayValue, delayUnit) {
  const now = new Date();
  const delay = {
    'minutes': delayValue * 60 * 1000,
    'hours': delayValue * 60 * 60 * 1000,
    'days': delayValue * 24 * 60 * 60 * 1000
  }[delayUnit] || 0;

  return new Date(now.getTime() + delay).toISOString();
}

/**
 * Send delayed email to customer using FreeScout's scheduledAt feature
 */
async function sendDelayedEmailToCustomer(conversationId, subject, body, delayValue, delayUnit) {
  try {
    const scheduledAt = calculateScheduledDateTime(delayValue, delayUnit);

    const requestBody = {
      type: 'message',    // Correct thread type for agent reply
      text: body,         // FreeScout uses "text" not "body"
      user: 1,            // System user (required for agent threads)
      scheduledAt: scheduledAt  // ISO 8601 datetime
    };

    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      requestBody,
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Email scheduled for ${new Date(scheduledAt).toLocaleString()} (${delayValue} ${delayUnit}) in conversation ${conversationId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send delayed email:', error.response?.data || error.message);
    throw error;
  }
}


/**
 * Webhook endpoint for payment confirmation (SIGNED_AND_PAID)
 * External payment system calls this when customer completes payment & signing
 */
app.post('/webhook/signed-and-paid', async (req, res) => {
  try {
    console.log('\n💰 Webhook triggered - Payment & Signing confirmed');

    const { conversation_id, payment_date, payment_amount, reference_number } = req.body;

    if (!conversation_id) {
      return res.status(400).json({
        status: 'error',
        message: 'conversation_id is required'
      });
    }

    console.log(`📧 Processing payment confirmation for conversation ID: ${conversation_id}`);
    console.log(`   Payment Date: ${payment_date || 'Not provided'}`);
    console.log(`   Amount: €${payment_amount || 'Not provided'}`);
    console.log(`   Reference: ${reference_number || 'Not provided'}`);

    // Update conversation with SIGNED_AND_PAID tag
    await updateConversationTags(conversation_id, ['SIGNED_AND_PAID']);

    // Add line item for payment confirmation
    const paymentText = `Payment confirmed: €${payment_amount || 'N/A'} - ${payment_date || 'N/A'} (Ref: ${reference_number || 'N/A'})`;

    await addLineItem(conversation_id, paymentText);

    console.log(`✅ SIGNED_AND_PAID tag added to conversation ${conversation_id}`);
    console.log(`   → Workflow 15 will trigger Email 5 automatically\n`);

    res.json({
      status: 'success',
      conversation_id,
      message: 'SIGNED_AND_PAID tag added, Email 5 will be sent automatically',
      payment_details: {
        date: payment_date,
        amount: payment_amount,
        reference: reference_number
      }
    });

  } catch (error) {
    console.error('💥 Payment webhook error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * FreeScout Webhook Event Handler
 * Handles event-based webhooks triggered by FreeScout workflows
 */
app.post('/webhook/event', async (req, res) => {
  try {
    console.log('\n🔔 FreeScout webhook event received');


    // FreeScout sends event name in header, not body
    const event = req.headers['x-freescout-event'] || req.body.event;

    // FreeScout sends the entire conversation object at root level
    const conversationId = req.body.id;
    const mailboxId = req.body.mailbox?.id;

    if (!event) {
      return res.status(400).json({
        status: 'error',
        message: 'event name is required (in x-freescout-event header or body)'
      });
    }

    console.log(`🎯 Event: ${event}`);
    console.log(`📧 Conversation ID: ${conversationId}`);
    console.log(`📫 Mailbox ID: ${mailboxId || 'not provided'}`);

    // Route to appropriate handler based on event name
    // Pass the entire conversation object from req.body (no need to fetch it again)
    switch (event) {
      case 'workflow.convo.box3.welcome.generate':
        await handleWelcomeGenerate(req.body, res);
        break;

      case 'workflow.convo.box3.intent.detect':
        await handleIntentDetect(req.body, res);
        break;

      case 'workflow.convo.box3.draft.generate':
        await handleDraftGenerate(req.body, res);
        break;

      default:
        console.log(`⚠️  Unknown event: ${event}`);
        res.json({
          status: 'success',
          message: `Event received but no handler configured for: ${event}`
        });
    }

  } catch (error) {
    console.error('💥 Webhook event error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Handler for workflow.convo.box3.welcome.generate
 */
async function handleWelcomeGenerate(conversation, res) {
  try {
    console.log('👋 Handling welcome email generation...');

    const conversationId = conversation.id;

    if (!conversationId) {
      return res.status(400).json({
        status: 'error',
        message: 'conversation_id is required'
      });
    }

    const subject = conversation.subject || '';
    const customerName = conversation.customer?.first_name || 'klant';
    const language = conversation.locale || 'nl'; // Get conversation language

    // Get service context from custom fields
    const serviceContext = getServiceContext(conversation);

    // Extract customer's initial message
    const threads = conversation._embedded?.threads || [];
    const firstCustomerMessage = threads
      .filter(t => t.type === 'customer' || t.type === 'message')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

    // If no customer message yet (lead import, form submission), use subject/custom fields
    let customerMessage = '';
    if (firstCustomerMessage) {
      customerMessage = firstCustomerMessage.body;
      console.log(`📝 Generating personalized welcome for ${customerName} based on their message...`);
    } else {
      console.log(`⚠️  No customer message found - generating welcome based on subject and custom fields`);
      customerMessage = `New lead imported. Subject: ${subject}. Customer has not sent a message yet.`;
    }

    // Generate personalized welcome email using AI
    const welcomeEmailBody = await generateWelcomeEmail(customerMessage, subject, customerName, language, serviceContext, conversation);

    // Send the welcome email
    await sendEmailToCustomer(
      conversationId,
      'Welkom - Uw Box 3 bezwaar traject',
      welcomeEmailBody
    );

    // Create Email 2: Upload Request (with 5 minute delay)
    const uploadRequestSubject = language === 'en'
      ? 'Action required: Submit actual return data'
      : 'Actie vereist: Aanleveren gegevens werkelijk rendement';

    const uploadRequestBody = language === 'en'
      ? `<p>Dear {%customer.fullName%},</p>

<p>To make your objection based on actual returns viable, we need more than just your tax return. The Dutch Tax Authority calculates with fictitious percentages, but we want to calculate with what actually happened.</p>

<p>Please reply to this email with the documents listed below. In your response, please clearly indicate which tax year this concerns.</p>

<h3>1. Income Tax Return</h3>
<p>The PDF of the submitted tax return for the relevant year.</p>
<p><strong>Why:</strong> This is our starting point to see how the Tax Authority has calculated your wealth.</p>
<p><strong>Where to find:</strong> You can download this by logging into My Tax Authority (under the 'Income Tax' tab).</p>

<h3>2. Bank Accounts (Interest & Currency)</h3>
<p>An overview of actually received interest and any currency results.</p>
<p><strong>Why:</strong> We must prove that your actual savings interest is lower than the notional return used by the tax authority.</p>
<p><strong>Where to find:</strong> This is in the annual financial overview you can download from your banking app or internet banking.</p>

<h3>3. Investments</h3>
<p>An overview with opening balance (Jan 1), closing balance (Dec 31), any deposits/withdrawals, and received dividends.</p>
<p><strong>Why:</strong> Returns consist not only of dividends, but also of price gains or losses. By comparing opening and closing balances (adjusted for deposits), we calculate your exact wealth growth.</p>
<p><strong>Where to find:</strong> Consult the tax annual overview of your investment account or broker.</p>

<h3>4. Real Estate & Other Assets</h3>
<p>The WOZ value on January 1 of the relevant year AND that of the following year (T+1). If rented: an overview of rental income.</p>
<p><strong>Why:</strong> For real estate, total return counts: that's the value increase (indirect return) plus rental income (direct return).</p>
<p><strong>Where to find:</strong> On the WOZ assessment from the municipality or via wozwaardeloket.nl.</p>

<h3>5. Debts</h3>
<p>An overview of debts and interest paid.</p>
<p><strong>Why:</strong> The interest you pay on debts (in box 3) reduces your actual return. We include this in the calculation in favor of your result.</p>
<p><strong>Where to find:</strong> In the annual statement from your mortgage provider or lender.</p>

<p><strong>How to submit your documents securely:</strong></p>

<p><strong>Option 1 — Via email</strong><br>
Reply to this email and attach your documents.<br>
Allowed file formats: PDF, JPG, PNG, DOC, DOCX.</p>

<p><strong>Option 2 — Via our secure upload environment (recommended)</strong><br>
Upload your documents securely via our secure environment:<br>
👉 <a href="https://automail.jandebelastingman.nl/help/2796044459/tickets">Klik hier om documenten veilig te uploaden</a></p>

<p>Once we have these documents complete, we will start the analysis within 1-2 business days.</p>`
      : `<p>Beste {%customer.fullName%},</p>

<p>Om uw bezwaar op basis van werkelijk rendement kansrijk te maken, hebben wij meer nodig dan alleen uw belastingaangifte. De Belastingdienst rekent met fictieve percentages, maar wij willen rekenen met wat er écht is gebeurd.</p>

<p>Wilt u deze e-mail beantwoorden met de onderstaande documenten? Vermeld in uw reactie s.v.p. ook duidelijk om welk belastingjaar het gaat.</p>

<h3>1. De aangifte inkomstenbelasting</h3>
<p>De PDF van de ingediende aangifte van het betreffende jaar.</p>
<p><strong>Waarom:</strong> Dit is ons startpunt om te zien hoe de Belastingdienst uw vermogen nu heeft berekend.</p>
<p><strong>Waar te vinden:</strong> U kunt deze downloaden door in te loggen op Mijn Belastingdienst (onder het tabblad 'Inkomstenbelasting').</p>

<h3>2. Bankrekeningen (Rente & Valuta)</h3>
<p>Een overzicht van de daadwerkelijk ontvangen rente en eventuele valutaresultaten.</p>
<p><strong>Waarom:</strong> Wij moeten aantonen dat uw werkelijk ontvangen spaarrente lager is dan het forfaitaire rendement waar de fiscus mee rekent.</p>
<p><strong>Waar te vinden:</strong> Dit staat in het financieel jaaroverzicht dat u kunt downloaden in uw bankieren-app of via internetbankieren.</p>

<h3>3. Beleggingen</h3>
<p>Een overzicht met de beginstand (1 jan), eindstand (31 dec), eventuele stortingen/onttrekkingen en de ontvangen dividenden.</p>
<p><strong>Waarom:</strong> Rendement bestaat niet alleen uit dividend, maar ook uit koerswinst of -verlies. Door de begin- en eindstand te vergelijken (gecorrigeerd voor stortingen), berekenen we uw exacte vermogensgroei.</p>
<p><strong>Waar te vinden:</strong> Raadpleeg hiervoor het fiscale jaaroverzicht van uw beleggingsrekening of broker.</p>

<h3>4. Vastgoed & overige bezittingen</h3>
<p>De WOZ-waarde op 1 januari van het betreffende jaar én die van het jaar erna (T+1). Indien verhuurd: een overzicht van de huuropbrengsten.</p>
<p><strong>Waarom:</strong> Voor vastgoed telt het totaalrendement: dat is de waardestijging (indirect rendement) plus de huurinkomsten (direct rendement).</p>
<p><strong>Waar te vinden:</strong> Op de WOZ-beschikking van de gemeente of via wozwaardeloket.nl.</p>

<h3>5. Schulden</h3>
<p>Een overzicht van de schulden en de betaalde rente.</p>
<p><strong>Waarom:</strong> De rente die u betaalt over schulden (in box 3) verlaagt uw werkelijke rendement. Dit nemen we mee in de berekening ten gunste van uw resultaat.</p>
<p><strong>Waar te vinden:</strong> In de jaaropgave van uw hypotheekverstrekker of kredietverlener.</p>

<p><strong>U kunt uw documenten op twee manieren veilig aanleveren:</strong></p>

<p><strong>Optie 1 — Via e-mail</strong><br>
Beantwoord deze e-mail en voeg uw documenten toe.<br>
Toegestane bestandsformaten: PDF, JPG, PNG, DOC, DOCX.</p>

<p><strong>Optie 2 — Via onze beveiligde uploadomgeving (aanbevolen)</strong><br>
Upload uw documenten veilig via onze beveiligde omgeving:<br>
👉 <a href="https://automail.jandebelastingman.nl/help/2796044459/tickets">Klik hier om documenten veilig te uploaden</a></p>

<p>Zodra wij deze stukken compleet hebben, starten wij binnen 1-2 werkdagen met de analyse.</p>`;

    await sendDelayedEmailToCustomer(
      conversationId,
      uploadRequestSubject,
      uploadRequestBody,
      30, // delay value
      'minutes' // delay unit
    );

    // Add DOCS_REQUESTED tag
    await updateConversationTags(conversationId, ['DOCS_REQUESTED']);

    // Add line item for workflow tracking
    await addLineItem(
      conversationId,
      `Email 1: Welcome email sent (AI-generated, ${welcomeEmailBody.length} chars) | Email 2: Upload request scheduled (5 minute delay)`
    );

    console.log(`✅ Welcome email sent for conversation ${conversationId}`);
    console.log(`✅ Upload request email scheduled with 5 minute delay`);
    console.log(`✅ DOCS_REQUESTED tag added\n`);

    res.json({
      status: 'success',
      conversation_id: conversationId,
      email_length: welcomeEmailBody.length,
      upload_request_delay: '5 minutes',
      message: 'Welcome email sent and upload request scheduled with 5 minute delay'
    });

  } catch (error) {
    console.error('💥 Welcome email generation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Handler for workflow.convo.box3.intent.detect
 */
async function handleIntentDetect(conversation, res) {
  try {
    console.log('🔍 Handling intent detection...');

    const conversationId = conversation.id;
    const mailboxId = conversation.mailbox?.id;

    if (!conversationId) {
      return res.status(400).json({
        status: 'error',
        message: 'conversation_id is required'
      });
    }

    console.log(`📧 Processing conversation ID: ${conversationId}, Mailbox: ${mailboxId}`);

    const subject = conversation.subject || '';

    // Extract text from threads
    const threads = conversation._embedded?.threads || [];
    const latestCustomerThread = threads
      .filter(t => t.type === 'customer' || t.type === 'message')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

    if (!latestCustomerThread) {
      console.log('⚠️  No customer message found');
      return res.status(400).json({
        status: 'error',
        message: 'No customer message found in conversation',
        conversation_id: conversationId
      });
    }

    const conversationText = latestCustomerThread.body;

    console.log(`📝 Analyzing text (${conversationText.length} chars)...`);

    // Detect intent using OpenAI
    const detectedIntent = await detectIntentWithOpenAI(conversationText, subject);

    // Update conversation with intent tag
    await updateConversationTags(conversationId, [detectedIntent]);

    // Add line item for intent detection
    await addLineItem(
      conversationId,
      `Intent detected: ${detectedIntent}`
    );

    console.log(`✅ Intent detection complete: ${detectedIntent}\n`);

    res.json({
      status: 'success',
      intent: detectedIntent,
      conversation_id: conversationId,
      mailbox_id: mailboxId,
      analyzed_text_length: conversationText.length
    });

  } catch (error) {
    console.error('💥 Intent detection error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Handler for workflow.convo.box3.draft.generate
 */
async function handleDraftGenerate(conversation, res) {
  try {
    console.log('✍️  Handling draft generation...');

    const conversationId = conversation.id;

    if (!conversationId) {
      return res.status(400).json({
        status: 'error',
        message: 'conversation_id is required'
      });
    }

    console.log(`📧 Generating draft for conversation ID: ${conversationId}`);

    const userId = conversation.user_id;
    const language = conversation.locale || 'nl'; // Get conversation language

    // Get service context from custom fields
    const serviceContext = getServiceContext(conversation);

    // Build conversation history
    const threads = conversation._embedded?.threads || [];
    const conversationHistory = threads
      .filter(t => t.type === 'customer' || t.type === 'message' || t.type === 'reply')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(t => {
        const sender = t.type === 'customer' ? 'Customer' : 'Agent';
        return `[${sender}]: ${t.body}`;
      })
      .join('\n\n');

    const subject = conversation.subject || '';

    console.log(`📝 Analyzing conversation (${conversationHistory.length} chars)...`);

    // Generate draft using OpenAI with agent-specific prompt
    const draftReply = await generateDraftReply(conversationHistory, subject, userId, language, serviceContext, conversation);

    // Create draft thread in FreeScout
    await createDraftReply(conversationId, draftReply, userId);

    console.log(`✅ Draft generation complete for conversation ${conversationId}\n`);

    res.json({
      status: 'success',
      conversation_id: conversationId,
      draft_length: draftReply.length,
      message: 'Draft reply created successfully'
    });

  } catch (error) {
    console.error('💥 Draft generation error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Test endpoint
 */
app.post('/test/detect-intent', async (req, res) => {
  try {
    const { text, subject } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const intent = await detectIntentWithOpenAI(text, subject || '');

    res.json({
      status: 'success',
      intent,
      input: { text, subject }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start server
app.listen(CONFIG.port, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Box3 Workflow Automation - Webhook Server       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n🚀 Server running on port ${CONFIG.port}`);
  console.log(`\n📍 Webhook Endpoints:`);
  console.log(`  🎯 Event Handler:   http://localhost:${CONFIG.port}/webhook/event`);
  console.log(`     • workflow.convo.box3.welcome.generate`);
  console.log(`     • workflow.convo.box3.intent.detect`);
  console.log(`     • workflow.convo.box3.draft.generate`);
  console.log(`\n  💰 Payment Webhook: http://localhost:${CONFIG.port}/webhook/signed-and-paid`);
  console.log(`\n🔧 Utility Endpoints:`);
  console.log(`  🏥 Health Check:    http://localhost:${CONFIG.port}/health`);
  console.log(`  🧪 Test Intent:     http://localhost:${CONFIG.port}/test/detect-intent`);
  console.log(`\n⚙️  Configuration:`);
  console.log(`  ${CONFIG.openaiApiKey ? '✅' : '❌'} OpenAI API Key: ${CONFIG.openaiApiKey ? 'Configured' : 'Missing'}`);
  console.log(`  ${CONFIG.freescoutApiKey ? '✅' : '❌'} FreeScout API: ${CONFIG.freescoutApiKey ? 'Configured' : 'Missing'}`);
  console.log(`  ${CONFIG.onyxAiApiKey ? '✅' : '⚠️ '} Onyx AI (RAG):  ${CONFIG.onyxAiApiKey ? 'Configured' : 'Not configured (optional)'}`);
  console.log(`\n🌐 FreeScout URL: ${CONFIG.freescoutUrl}`);
  console.log(`📚 Onyx AI URL:   ${CONFIG.onyxAiUrl}`);

  if (!CONFIG.openaiApiKey) {
    console.log(`\n⚠️  WARNING: OPENAI_API_KEY not set in .env file!`);
    console.log(`   AI features will not work without OpenAI API key.`);
  }

  if (!CONFIG.freescoutApiKey) {
    console.log(`\n⚠️  WARNING: FREESCOUT_API_TOKEN not set in .env file!`);
    console.log(`   Cannot communicate with FreeScout API.`);
  }

  if (CONFIG.onyxAiApiKey) {
    console.log(`\n📚 Onyx AI enabled: Intake Agent (ID 22) will use RAG for document-grounded responses`);
  }

  console.log(`\n✨ Ready to handle webhook events!\n`);
});

export default app;
