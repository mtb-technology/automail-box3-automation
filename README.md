# Box 3 Workflow Automation System

AI-powered workflow automation system for FreeScout, specifically designed for Box 3 tax advisory services.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Documentation](#documentation)
- [License](#license)

## ✨ Features

- **AI-Powered Intent Detection**: Uses OpenAI GPT-4o-mini to detect customer intent automatically
- **Personalized Welcome Emails**: AI-generated, context-aware welcome messages
- **Smart Draft Generation**: Creates AI drafts for agents based on conversation history
- **Document-Grounded Responses**: Onyx AI integration for the Intake Agent (RAG)
- **Complete Customer Lifecycle**: 16 workflows covering from initial contact to payment confirmation
- **Dynamic Webhook Registration**: Automatically extracts and registers webhooks from workflow definitions
- **Agent-Specific Prompts**: 6 specialized AI agents (Triage, Intake, Quote, Closing, Onboarding, Payment)

## 📁 Project Structure

```
box3-workflows/
├── config/                          # Configuration files
│   ├── box3-workflows-full-lifecycle.json   # 16 workflow definitions
│   └── .env.example                 # Environment variables template
├── docs/                            # Documentation
│   ├── COMPLETE-LIFECYCLE.md        # Full workflow lifecycle guide
│   ├── DEPLOYMENT-COMPLETE.md       # Deployment summary
│   ├── WEBHOOK-CONFIGURATION.md     # Webhook setup guide
│   └── WORKFLOW-CREATION-GUIDE.md   # Creating new workflows
├── diagrams/                        # Visual diagrams
│   ├── view-diagram-full.html       # Interactive workflow diagram
│   └── workflow-diagram-full.mmd    # Mermaid diagram source
├── scripts/                         # Utility scripts
│   ├── deploy-workflows.js          # Deploy workflows to FreeScout
│   └── update-workflows.js          # Update existing workflows
├── src/                             # Source code
│   └── webhook-server.js            # Main webhook server
├── .env                             # Environment variables (not in git)
├── package.json                     # Node.js dependencies
└── README.md                        # This file
```

## 🚀 Installation

### Prerequisites

- Node.js 18+ and npm
- FreeScout instance with API access
- OpenAI API key
- (Optional) Onyx AI server for document retrieval

### Steps

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp config/.env.example .env
   ```

   Edit `.env` and fill in your API keys:
   ```env
   # Webhook Server
   WEBHOOK_PORT=3000

   # OpenAI
   OPENAI_API_KEY=sk-...

   # FreeScout
   FREESCOUT_BASE_URL=https://freescout.test
   FREESCOUT_API_TOKEN=your_api_token_here
   WEBHOOK_SERVER_URL=http://localhost:3000

   # Onyx AI (optional)
   ONYX_AI_URL=http://localhost:8080
   ONYX_AI_API_KEY=your_onyx_api_key_here
   ```

## ⚙️ Configuration

### FreeScout API Token

1. Go to **FreeScout > Manage > API**
2. Create a new API token
3. Enable permissions: `conversations`, `workflows`, `tags`, `webhooks`
4. Copy the token to `.env`

### Workflow Configuration

Edit `config/box3-workflows-full-lifecycle.json` to customize:
- Workflow names and descriptions
- Conditions (triggers)
- Actions (what happens)
- Agent assignments
- Email templates

## 📖 Usage

### Start Webhook Server

```bash
npm start
```

Or with PM2 for production:
```bash
npm run pm2:start
npm run pm2:logs
```

### Deploy Workflows

First time setup:
```bash
npm run deploy
```

This will:
1. Scan workflows for webhook actions
2. Register webhooks with FreeScout
3. Deploy all 16 workflows to mailbox 3

### Update Existing Workflows

If you modified workflows and want to update specific ones:
```bash
npm run update
```

### View Workflow Diagram

Open `diagrams/view-diagram-full.html` in a browser to see an interactive visualization of all workflows.

## 🔍 Testing

### Test Webhook Server Health

```bash
curl http://localhost:3000/health
```

### Test AI Intent Detection

```bash
curl -X POST http://localhost:3000/test/detect-intent \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Ik wil graag hulp met mijn Box 3 bezwaar",
    "subject": "Box 3 vraag"
  }'
```

### Test Webhook Event

```bash
curl -X POST http://localhost:3000/webhook/event \
  -H "Content-Type: application/json" \
  -d '{
    "event": "workflow.convo.box3.welcome.generate",
    "conversation": { "id": 123 }
  }'
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| **COMPLETE-LIFECYCLE.md** | Full lifecycle documentation with all 16 workflows explained |
| **DEPLOYMENT-COMPLETE.md** | Deployment summary and system architecture |
| **WEBHOOK-CONFIGURATION.md** | Detailed webhook configuration guide |
| **WORKFLOW-CREATION-GUIDE.md** | How to create and modify workflows |

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────┐
│  Customer Email → FreeScout Mailbox 3       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Workflows (16 total)                       │
│  • Welcome & Triage                         │
│  • Document Collection                      │
│  • Analysis & Questions                     │
│  • Offer & Payment                          │
│  • Confirmation                             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Webhook Events                             │
│  • workflow.convo.box3.welcome.generate     │
│  • workflow.convo.box3.intent.detect        │
│  • workflow.convo.box3.draft.generate       │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Webhook Server (http://localhost:3000)     │
│  /webhook/event → Routes to handlers        │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  AI Processing                              │
│  • OpenAI GPT-4o-mini (intent, drafts)      │
│  • Onyx AI (document retrieval)             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  FreeScout API                              │
│  • Send emails                              │
│  • Update tags                              │
│  • Create notes                             │
│  • Assign agents                            │
└─────────────────────────────────────────────┘
```

## 🔧 Development

### Project Scripts

```bash
# Start webhook server
npm start

# Deploy workflows
npm run deploy

# Update workflows
npm run update

# Production mode (PM2)
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
npm run pm2:status
```

### Adding New Workflows

1. Edit `config/box3-workflows-full-lifecycle.json`
2. Add your workflow definition
3. If using webhooks, use event name format: `workflow.convo.box3.your.event`
4. Run `npm run deploy` to register and deploy

The deploy script will automatically:
- Extract webhook events
- Register them with FreeScout
- Deploy the new workflow

## 🐛 Troubleshooting

### Webhooks Not Firing

1. Check webhook server is running: `curl http://localhost:3000/health`
2. Check FreeScout workflow logs
3. Verify event names match exactly
4. Review webhook server logs

### AI Not Generating Responses

1. Verify `OPENAI_API_KEY` is set correctly
2. Check OpenAI API usage limits
3. Review webhook server logs for errors
4. Test with `/test/detect-intent` endpoint

### Deployment Fails

1. Verify `FREESCOUT_API_TOKEN` has correct permissions
2. Check FreeScout is accessible
3. Review error messages in deploy script output
4. Ensure workflows don't have duplicate names

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions:
- Check the documentation in `docs/`
- Review troubleshooting section above
- Open an issue on GitHub

---

**Built with ❤️ for Box 3 tax advisory services**
