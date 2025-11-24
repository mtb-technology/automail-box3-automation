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
app.use(express.json());

const CONFIG = {
  port: process.env.WEBHOOK_PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  freescoutUrl: process.env.FREESCOUT_BASE_URL || 'https://freescout.test',
  freescoutApiKey: process.env.FREESCOUT_API_TOKEN,
  onyxAiUrl: process.env.ONYX_AI_URL || 'http://localhost:8080',
  onyxAiApiKey: process.env.ONYX_AI_API_KEY,
};

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
    // First, fetch existing tags
    const getResponse = await axios.get(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}`,
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    const existingTags = getResponse.data.tags || [];

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
async function generateDraftReply(conversationHistory, subject, assignedUserId) {
  try {
    // Get agent-specific prompt or use default
    const agentConfig = AGENTS[assignedUserId];
    const agentPrompt = agentConfig ? agentConfig.prompt : DEFAULT_AGENT_PROMPT;
    const agentName = agentConfig ? agentConfig.name : 'General Agent';

    console.log(`📝 Using ${agentName} prompt (User ID: ${assignedUserId})`);

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
            content: `Subject: ${subject}\n\nConversation history:\n${conversationHistory}${additionalContext}\n\nGenerate a draft reply for the agent to review and send.`
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
async function generateWelcomeEmail(customerMessage, subject, customerName) {
  try {
    console.log(`📝 Generating personalized welcome email for ${customerName}...`);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the Welcome Agent for Jan de Belastingman - Box 3 bezwaar service.

Your role: Create a warm, personalized welcome email that acknowledges the customer's specific situation and explains the process.

**Email Structure:**
1. **Personal greeting** - Address them by name, acknowledge their specific situation from their message
2. **Process overview** - Explain the 5-step Box 3 bezwaar process:
   - Stap 1: U stuurt uw meest recente aangifte inkomstenbelasting
   - Stap 2: Wij analyseren uw situatie en stellen eventueel aanvullende vragen
   - Stap 3: U ontvangt een persoonlijk voorstel met verwacht resultaat
   - Stap 4: Na akkoord verwerken wij de ondertekening en betaling
   - Stap 5: Wij starten met uw bezwaarschrift bij de Belastingdienst
3. **Next step** - "U ontvangt binnen enkele minuten een e-mail met het verzoek om uw aangifte te uploaden."

**Formatting:**
- Use HTML formatting for clarity (<p>, <strong>, <ol>, <li>, etc.)
- Structure the 5 steps as an ordered list with <ol> and <li> tags

**Tone:**
- Professional but friendly
- Reassuring and confident
- Show you understand their concern about Box 3
- Personalize based on their initial message (reference what they mentioned)

**Important:**
- Write in Dutch (unless customer wrote in English)
- Keep it concise (3-4 paragraphs max)
- Make them feel they made the right choice

IMPORTANT - NO SIGNATURES:
- DO NOT include any closing signatures (NO "Met vriendelijke groet", "Kind regards", "Best regards", etc.)
- DO NOT include sender name or company name at the end
- The system will add these automatically - your output should END with the last sentence of content

Respond with ONLY the email body (no subject line).`
          },
          {
            role: 'user',
            content: `Customer name: ${customerName}
Subject: ${subject}

Customer's initial message:
${customerMessage}

Generate a personalized welcome email that acknowledges their specific situation.`
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
async function sendEmailToCustomer(conversationId, subject, body) {
  try {
    const response = await axios.post(
      `${CONFIG.freescoutUrl}/api/conversations/${conversationId}/threads`,
      {
        type: 'message',
        text: body,  // FreeScout uses "text" not "body"
        user: 1      // System user
      },
      {
        headers: {
          'X-Automail-API-Key': CONFIG.freescoutApiKey,
          'Content-Type': 'application/json'
        },
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      }
    );

    console.log(`✅ Email sent to customer in conversation ${conversationId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send email:', error.response?.data || error.message);
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

    // Add note with payment details
    const noteText = `[PAYMENT_CONFIRMED] Customer has signed and paid

💰 Payment Details:
- Date: ${payment_date || 'N/A'}
- Amount: €${payment_amount || 'N/A'}
- Reference: ${reference_number || 'N/A'}

✅ Workflow 15 will automatically send confirmation email (Email 5)`;

    await addNote(conversation_id, noteText);

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

    // Extract customer's initial message
    const threads = conversation._embedded?.threads || [];
    const firstCustomerMessage = threads
      .filter(t => t.type === 'customer' || t.type === 'message')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

    if (!firstCustomerMessage) {
      console.log('⚠️  No customer message found');
      return res.status(400).json({
        status: 'error',
        message: 'No customer message found in conversation'
      });
    }

    const customerMessage = firstCustomerMessage.body;

    console.log(`📝 Generating personalized welcome for ${customerName}...`);

    // Generate personalized welcome email using AI
    const welcomeEmailBody = await generateWelcomeEmail(customerMessage, subject, customerName);

    // Send the welcome email
    await sendEmailToCustomer(
      conversationId,
      'Welkom - Uw Box 3 bezwaar traject',
      welcomeEmailBody
    );

    // Add note about AI generation
    await addNote(
      conversationId,
      `[BOX3_FLOW] Email 1 verzonden: Welkom & Proces (AI-generated, personalized)\n\nGenerated ${welcomeEmailBody.length} characters based on customer's initial message.`
    );

    console.log(`✅ Welcome email sent for conversation ${conversationId}\n`);

    res.json({
      status: 'success',
      conversation_id: conversationId,
      email_length: welcomeEmailBody.length,
      message: 'Personalized welcome email sent successfully'
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

    // Add note to conversation
    await addNote(
      conversationId,
      `[INTENT_DETECTED] ${detectedIntent}\n\nDetected by OpenAI based on latest customer message.`
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
    const draftReply = await generateDraftReply(conversationHistory, subject, userId);

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
