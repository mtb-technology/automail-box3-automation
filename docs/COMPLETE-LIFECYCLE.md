# Box3 Complete Customer Lifecycle

Complete workflow system from first contact to payment, including document tracking, analysis, dynamic questions, and offer management.

---

## 📊 Lifecycle Overview

```
NEW EMAIL → DOCS_REQUESTED → DOCS_RECEIVED → ANALYSIS → QUESTIONS → OFFER → PAYMENT → ONBOARDING
```

### Timeline Example
```
Day 0:  Customer email → Welcome + Upload request
Day 1:  Customer uploads docs → DOCS_RECEIVED
Day 2:  [No docs? → Reminder 1]
Day 3:  Intake agent analyzes → Adds QUESTIONS_PREPARED tag
Day 3:  Email 3 sent automatically → Customer receives questions
Day 5:  Customer answers → QUESTIONS_ANSWERED → Fiscalist assigned
Day 6:  Fiscalist creates offer → Adds OFFER_READY tag
Day 6:  Email 4 sent automatically → Customer receives offer
Day 9:  [No response? → Offer Reminder 1]
Day 10: Customer accepts → PAYMENT_STARTED
Day 11: Payment confirmed → Onboarding starts
```

---

## 🎯 Complete State Machine

### Phase 1: Document Collection

**States:**
- `DOCS_REQUESTED` - Upload email sent
- `DOCS_RECEIVED` - Customer uploaded documents
- `DOCS_UNDER_REVIEW` - Intake agent analyzing

**Workflows:**
1. Welcome email (immediate)
2. Upload request (+2 minutes)
3. Document reminder 1 (+2 days if no upload)
4. Document reminder 2 (+7 days if no upload)
5. Upload detection (when attachment received)

**Agent:** Unassigned → Intake Agent (when docs received)

### Phase 2: Analysis & Questions

**States:**
- `QUESTIONS_PREPARED` - Agent manually sets after analyzing docs
- `QUESTIONS_SENT` - Email 3 sent automatically
- `QUESTIONS_ANSWERED` - Customer replied with answers

**Workflows:**
6. Email 3: Dynamic questions (triggered by QUESTIONS_PREPARED tag)
7. Route to fiscalist (when QUESTIONS_ANSWERED detected)

**Agent:** Intake Agent → Quote Agent/Fiscalist

**Manual Trigger:**
Intake agent must manually add `QUESTIONS_PREPARED` tag when ready to send questions.

### Phase 3: Offer & Payment

**States:**
- `OFFER_READY` - Fiscalist manually sets after calculating
- `OFFER_SENT` - Email 4 sent automatically
- `PAYMENT_STARTED` - Customer accepted offer
- `Payment_Confirmed` - Payment received

**Workflows:**
8. Email 4: Final offer (triggered by OFFER_READY tag)
9. Offer reminder 1 (+3 days if no payment)
10. Offer reminder 2 (+10 days if no payment)
11. Payment confirmation → Onboarding

**Agent:** Quote Agent → Payment Agent → Onboarding Agent

**Manual Trigger:**
Fiscalist must manually add `OFFER_READY` tag after creating offer.

### Phase 4: Closed States

**States:**
- `CLOSED_LOST` - Customer declined
- `Payment_Confirmed` - Success, move to onboarding

**Workflows:**
12. CLOSED_LOST email (when customer says "ik wil niet verder")

---

## 📧 Email Sequence

### Email 1: Welcome (Automatic)
**Trigger:** New conversation with "Box 3" in subject
**Content:**
- Welcome message
- Process overview (5 steps)
- What to expect next

### Email 2: Upload Request (Automatic, +2min)
**Trigger:** 2 minutes after welcome email
**Content:**
- Request for tax return
- Upload instructions
- Accepted formats
**Sets state:** `DOCS_REQUESTED`

### Email 2a: Reminder 1 (Automatic, +2 days)
**Trigger:** 2 days, still `DOCS_REQUESTED`, no `DOCS_RECEIVED`
**Content:**
- Friendly reminder
- Why docs are needed
- Help with uploading

### Email 2b: Reminder 2 (Automatic, +7 days)
**Trigger:** 7 days, still `DOCS_REQUESTED`, no `DOCS_RECEIVED`
**Content:**
- Final reminder
- Option to decline
- Help offer

### Email 3: Dynamic Questions (Automatic, manual trigger)
**Trigger:** Intake agent adds `QUESTIONS_PREPARED` tag
**Content:**
- Questions about WONING (if applicable)
- Questions about BELEGGINGEN (if applicable)
- Questions about SPAARGELD (if applicable)
- Questions about SCHULDEN (if applicable)
- Link to online form
**Sets state:** `QUESTIONS_SENT`

### Email 4: Final Offer (Automatic, manual trigger)
**Trigger:** Fiscalist adds `OFFER_READY` tag
**Content:**
- Expected benefit (€X - €Y)
- Our fee
- Net benefit calculation
- What we do
- Sign & pay button
**Sets state:** `OFFER_SENT`

### Email 4a: Offer Reminder 1 (Automatic, +3 days)
**Trigger:** 3 days, still `OFFER_SENT`, no `PAYMENT_STARTED`
**Content:**
- Friendly reminder
- FAQ link
- Help offer
- Direct sign & pay link

### Email 4b: Offer Reminder 2 (Automatic, +10 days)
**Trigger:** 10 days, still `OFFER_SENT`, no `PAYMENT_STARTED`
**Content:**
- Final reminder
- Phone number for help
- Option to decline
- Sign & pay link

---

## 👥 Agent Assignments

### Automatic Assignments

| State | Agent | ID | Purpose |
|-------|-------|-----|---------|
| `DOCS_RECEIVED` | Intake Agent | 22 | Analyze documents, prepare questions |
| `QUESTIONS_ANSWERED` | Quote Agent/Fiscalist | 23 | Calculate offer, determine fee |
| `OFFER_SENT` | Payment Agent | 26 | Monitor payment, add links |
| `Payment_Confirmed` | Onboarding Agent | 25 | Collect KYC documents |

### Agent Responsibilities

**Intake Agent (22):**
1. Review uploaded tax return
2. Determine which question categories apply:
   - WONING (has property?)
   - BELEGGINGEN (investments?)
   - SPAARGELD (savings above threshold?)
   - SCHULDEN (debts?)
3. Manually add `QUESTIONS_PREPARED` tag when ready
4. Monitor customer responses

**Quote Agent/Fiscalist (23):**
1. Review tax return + customer answers
2. Calculate:
   - Expected Box 3 correction
   - Expected refund/savings
   - Success probability (low/medium/high)
3. Determine fee (fixed or % of refund)
4. Manually add `OFFER_READY` tag when offer is ready
5. Ensure all placeholders in Email 4 are filled

**Payment Agent (26):**
1. Add actual sign & pay links to emails
2. Monitor payment status
3. Confirm payment received
4. Add `Payment_Confirmed` tag

**Onboarding Agent (25):**
1. Collect KYC documents (ID, BSN, Tax Return)
2. Verify documents
3. Start bezwaar process

---

## 🤖 Intent Detection

### Automatically Detected Intents

**Every customer reply triggers intent detection:**

| Intent | Trigger | Action |
|--------|---------|--------|
| `DOCS_RECEIVED` | Attachment present | Assign to Intake, set state |
| `QUESTIONS_ANSWERED` | Reply after QUESTIONS_SENT | Assign to Fiscalist |
| `Proposal_Accepted` | "akkoord", "ga ermee akkoord" | Send payment email, set PAYMENT_STARTED |
| `Payment_Confirmed` | "betaald", "betaling gedaan" | Assign to Onboarding |
| `CLOSED_LOST` | "ik wil niet verder" | Send closing email, close conversation |
| `Klant_Weigert` | "niet interested", "te duur" | Send closing email, close conversation |

### Intent Detection Flow
```
Customer replies
  ↓
Workflow 3: Intent Detection Webhook
  ↓
OpenAI analyzes message
  ↓
Sets tag (e.g., QUESTIONS_ANSWERED)
  ↓
Routing workflow triggers
  ↓
Agent reassignment or email sent
```

---

## 🔧 Manual Triggers

### 1. Trigger Email 3 (Questions)

**When:** After analyzing customer's tax return
**Who:** Intake Agent
**How:** Manually add tag `QUESTIONS_PREPARED`

**Steps:**
1. Review uploaded tax return
2. Determine which categories apply (WONING, BELEGGINGEN, etc.)
3. In FreeScout: Add tag `QUESTIONS_PREPARED`
4. Workflow 7 automatically sends Email 3
5. State changes to `QUESTIONS_SENT`

### 2. Trigger Email 4 (Offer)

**When:** After calculating final offer and fee
**Who:** Quote Agent/Fiscalist
**How:** Manually add tag `OFFER_READY`

**Steps:**
1. Calculate expected refund range
2. Determine fee amount/percentage
3. Assess success probability
4. Fill in placeholders in offer template:
   - [MIN] = minimum expected refund
   - [MAX] = maximum expected refund
   - [FEE] = your fee amount
   - [Y] = percentage if applicable
   - [NET_MIN] = MIN - FEE
   - [NET_MAX] = MAX - FEE
   - [HOOG/MIDDEL/LAAG] = success probability
5. In FreeScout: Add tag `OFFER_READY`
6. Workflow 9 automatically sends Email 4
7. State changes to `OFFER_SENT`

---

## 📋 State Tracking with Tags

### Tag Strategy

**Use tags as state indicators:**
- FreeScout workflows can check "contains tag X"
- Multiple tags can coexist
- Tags track progress through lifecycle

### Core Tags

```
Document Phase:
  DOCS_REQUESTED → DOCS_RECEIVED → DOCS_UNDER_REVIEW

Analysis Phase:
  QUESTIONS_PREPARED → QUESTIONS_SENT → QUESTIONS_ANSWERED

Offer Phase:
  OFFER_READY → OFFER_SENT → PAYMENT_STARTED → Payment_Confirmed

Closed:
  CLOSED_LOST
```

### Tag Management

**Automatic:**
- `DOCS_REQUESTED` - Set by Workflow 2
- `DOCS_RECEIVED` - Set by Workflow 3 (intent detection)
- `DOCS_UNDER_REVIEW` - Set by Workflow 4
- `QUESTIONS_SENT` - Set by Workflow 7
- `OFFER_SENT` - Set by Workflow 9
- `PAYMENT_STARTED` - Set by Workflow 13

**Manual:**
- `QUESTIONS_PREPARED` - Added by Intake Agent
- `OFFER_READY` - Added by Fiscalist

**Intent-based:**
- `QUESTIONS_ANSWERED` - Detected by AI
- `Proposal_Accepted` - Detected by AI
- `Payment_Confirmed` - Detected by AI
- `CLOSED_LOST` - Detected by AI

---

## ⏰ Reminder Logic

### Document Reminders

**Reminder 1: Day 2**
```
Conditions:
  - Has tag: DOCS_REQUESTED
  - Does NOT have tag: DOCS_RECEIVED
  - Waiting > 2 days

Action:
  - Send reminder email
  - Tone: Friendly, helpful
```

**Reminder 2: Day 7**
```
Conditions:
  - Has tag: DOCS_REQUESTED
  - Does NOT have tag: DOCS_RECEIVED
  - Waiting > 7 days

Action:
  - Send final reminder
  - Offer help
  - Mention option to decline
```

### Offer Reminders

**Reminder 1: Day 3**
```
Conditions:
  - Has tag: OFFER_SENT
  - Does NOT have tag: PAYMENT_STARTED
  - Waiting > 3 days

Action:
  - Send reminder
  - Include FAQ
  - Direct sign & pay link
```

**Reminder 2: Day 10**
```
Conditions:
  - Has tag: OFFER_SENT
  - Does NOT have tag: PAYMENT_STARTED
  - Waiting > 10 days

Action:
  - Send final reminder
  - Phone number for help
  - Clear option to decline
```

---

## 🎨 Dynamic Questions Logic

### Question Categories

**WONING (Property):**
- Trigger: Property ownership detected in tax return
- Questions:
  - When purchased/sold?
  - Is WOZ value correct?
  - Own home or investment property?

**BELEGGINGEN (Investments):**
- Trigger: Investment accounts > €0
- Questions:
  - Which banks/brokers?
  - Any loans for investments?

**SPAARGELD (Savings):**
- Trigger: Savings above threshold
- Questions:
  - Foreign accounts?
  - Large fluctuations around peildatum?

**SCHULDEN (Debts):**
- Trigger: Debts or other complex items
- Questions:
  - Type of debt?
  - Documentation available?

### Implementation

**Analysis by Intake Agent:**
1. Read tax return (OCR or manual)
2. Create internal `parsed_return` object with:
   - `has_property`: boolean
   - `has_investments`: boolean
   - `savings_amount`: number
   - `has_debts`: boolean
3. Determine `question_blocks` = [WONING, BELEGGINGEN, ...]
4. Manually add `QUESTIONS_PREPARED` tag
5. Email 3 is sent automatically with relevant sections

---

## 💰 Offer Calculation

### Variables in Email 4

**Customer sees:**
```
Verwacht voordeel: tussen €[MIN] en €[MAX]
Onze vergoeding: €[FEE] / [Y]% van voordeel
Netto voordeel: tussen €[NET_MIN] en €[NET_MAX]
Slagingskans: [HOOG/MIDDEL/LAAG]
```

**Fiscalist must provide:**
- `[MIN]` - Minimum expected refund (e.g., €2,000)
- `[MAX]` - Maximum expected refund (e.g., €5,000)
- `[FEE]` - Your fee (e.g., €500 or omit if percentage)
- `[Y]` - Percentage (e.g., 20 if 20% of refund, or omit if fixed)
- `[NET_MIN]` - MIN - FEE
- `[NET_MAX]` - MAX - FEE
- `[HOOG/MIDDEL/LAAG]` - Success probability assessment

**Calculation Example:**
```
Expected refund: €2,000 - €5,000
Fee: 25% of refund

Email shows:
  Verwacht voordeel: tussen €2,000 en €5,000
  Onze vergoeding: 25% van het behaalde voordeel
  Netto voordeel: tussen €1,500 en €3,750
  Slagingskans: HOOG
```

---

## 🚀 Deployment

### Deploy Full Lifecycle Workflows

```bash
# Use the complete lifecycle workflow file
node deploy-workflows.js --file box3-workflows-full-lifecycle.json
```

### Restart Webhook Server

```bash
# New intents added, restart required
npm start
```

### Verify Setup

1. **Check webhook server logs:**
   ```
   ✅ OpenAI API Key: Configured
   ✅ FreeScout API Key: Configured
   📚 Onyx AI enabled (optional)
   ```

2. **Verify FreeScout workflows:**
   - 15 workflows should be active
   - Mailbox: 3 (Box3)

3. **Test document upload:**
   - Create test conversation
   - Send email with attachment
   - Should set `DOCS_RECEIVED` tag
   - Should assign to Intake Agent (22)

---

## 📊 Workflow Summary

| # | Name | Trigger | Action | State Change |
|---|------|---------|--------|--------------|
| 1 | Welcome | New conversation | Send welcome email | - |
| 2 | Upload Request | +2 min after welcome | Request documents | → DOCS_REQUESTED |
| 3 | Intent Detection | Every customer reply | Analyze intent with AI | Varies |
| 4 | Route: Docs Received | DOCS_RECEIVED tag | Assign to Intake | → DOCS_UNDER_REVIEW |
| 5 | Reminder 1: Docs | +2 days, no docs | Send reminder 1 | - |
| 6 | Reminder 2: Docs | +7 days, no docs | Send reminder 2 | - |
| 7 | Email 3: Questions | QUESTIONS_PREPARED tag (manual) | Send questions | → QUESTIONS_SENT |
| 8 | Route: Questions Answered | QUESTIONS_ANSWERED tag | Assign to Fiscalist | - |
| 9 | Email 4: Offer | OFFER_READY tag (manual) | Send offer | → OFFER_SENT |
| 10 | Reminder 1: Offer | +3 days, no payment | Send reminder 1 | - |
| 11 | Reminder 2: Offer | +10 days, no payment | Send reminder 2 | - |
| 12 | Route: Closed Lost | CLOSED_LOST tag | Send closing email, close | - |
| 13 | Route: Proposal Accepted | Proposal_Accepted tag | Send payment email | → PAYMENT_STARTED |
| 14 | Route: Payment Confirmed | Payment_Confirmed tag | Assign to Onboarding | - |
| 15 | AI Draft Generation | Agent + customer reply | Generate draft | - |

---

## 🎯 Success Metrics

**Track these in FreeScout:**
- Conversion rate: DOCS_REQUESTED → DOCS_RECEIVED
- Time to docs upload (median)
- Questions completion rate: QUESTIONS_SENT → QUESTIONS_ANSWERED
- Offer acceptance rate: OFFER_SENT → PAYMENT_STARTED
- Time to payment (median)
- Closed lost rate by phase

**Reminders effectiveness:**
- % who upload after Reminder 1 vs Reminder 2
- % who accept after Offer Reminder 1 vs Reminder 2

---

**System ready for complete customer lifecycle management!** 🎉

All states, reminders, and agent assignments are now automated with manual trigger points for quality control.
