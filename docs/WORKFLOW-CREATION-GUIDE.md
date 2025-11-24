# Box3 Workflow Creation Guide for FreeScout

Since FreeScout doesn't support workflow creation via API, you'll need to create these 16 workflows manually through the FreeScout UI.

## 📋 Quick Reference

**Total Workflows:** 16
**Mailbox:** Box3 (ID: 3)
**Webhook Server:** http://localhost:3000

---

## 🚀 Workflow 1: AI-Generated Welcome Email

**Name:** `Box3 - 1. Welcome: New Conversation (AI-Generated)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Subject** - Matches regex: `(box ?3|vermogen|wealth)`
2. **Conversation Type** - Is new conversation

### Actions:
1. **Webhook** - POST to `http://localhost:3000/webhook/generate-welcome`
   - Payload: `{"conversation_id": "{{conversation.id}}"}`
2. **Set Status** - Active (2)

---

## 📧 Workflow 2: Upload Request

**Name:** `Box3 - 2. Email: Upload Request (DOCS_REQUESTED)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Body** - Contains: `[BOX3_FLOW] Email 1 verzonden`
2. **Waiting** - Longer than 2 minutes

### Actions:
1. **Email Customer** - Subject: `Stap 1: Upload uw aangifte inkomstenbelasting`
   - Body:
```
Beste {{customer.name}},

Om uw Box 3 bezwaar correct te kunnen beoordelen, hebben wij uw meest recente aangifte inkomstenbelasting nodig.

**Wat wij nodig hebben:**
- Uw aangifte inkomstenbelasting (laatste jaar)
- Eventuele bijlagen of toelichting

**Hoe te uploaden:**
Beantwoord deze e-mail en voeg de documenten als bijlage toe.

**Bestandsformaten:**
PDF, JPG, PNG, of DOC/DOCX

Wij verwerken uw aangifte binnen 1-2 werkdagen.

Met vriendelijke groet,

Box 3 Team
```

2. **Add Tag** - `DOCS_REQUESTED`
3. **Add Note** - `[BOX3_STATE] Status: DOCS_REQUESTED\n[BOX3_FLOW] Email 2 verzonden: Upload aangifte`

---

## ✓ Workflow 3: Simple Attachment Detection

**Name:** `Box3 - 3. Detect: Document Upload (Simple Attachment Check)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Has Tag** - `DOCS_REQUESTED`
2. **Attachment** - Yes (has attachment)
3. **Customer Reply** - In last 1 day

### Actions:
1. **Add Tag** - `DOCS_RECEIVED`
2. **Add Note** - `[BOX3_STATE] DOCS_REQUESTED → DOCS_RECEIVED\n[BOX3_FLOW] ✓ Aangifte ontvangen (attachment detected)`

---

## 🤖 Workflow 4: AI Intent Detection

**Name:** `Box3 - 4. Detect Intent: Customer Reply (NON-attachment replies)`
**Type:** Automatic
**Max Executions:** 999

### Conditions (ALL must match):
1. **Subject** - Matches regex: `(box ?3|vermogen|wealth)`
2. **Customer Reply** - In last 5 minutes
3. **Conversation Type** - Is reply
4. **Attachment** - No (no attachment)

### Actions:
1. **Webhook** - POST to `http://localhost:3000/webhook/detect-intent`
   - Payload: `{"conversation_id": "{{conversation.id}}", "mailbox_id": "{{conversation.mailbox_id}}"}`
2. **Add Note** - `[BOX3_INTENT] Intent detection webhook called for customer reply`

---

## 📬 Workflow 5: Route to Intake Agent

**Name:** `Box3 - 5. Route: DOCS_RECEIVED → Intake`
**Type:** Automatic
**Max Executions:** 1

### Conditions:
1. **Has Tag** - `DOCS_RECEIVED`

### Actions:
1. **Add Tag** - `DOCS_UNDER_REVIEW`
2. **Add Note** - `[BOX3_STATE] Status: DOCS_RECEIVED → DOCS_UNDER_REVIEW\n[BOX3_FLOW] Aangifte ontvangen - Intake agent start analyse`
3. **Assign to User** - Intake Agent (ID: 22)
4. **Set Status** - Active (1)
5. **Send Notification** - To assignee

---

## ⏰ Workflow 6: Document Reminder 1 (2 days)

**Name:** `Box3 - 6. Reminder 1: Docs Not Received (2 days)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Has Tag** - `DOCS_REQUESTED`
2. **Does NOT have Tag** - `DOCS_RECEIVED`
3. **Waiting** - Longer than 2 days

### Actions:
1. **Email Customer** - Subject: `Herinnering: Upload uw aangifte (Dag 2)`
   - Body:
```
Beste {{customer.name}},

Wij hebben nog geen aangifte van u ontvangen.

**Waarom hebben we dit nodig?**
Uw aangifte is cruciaal om te bepalen hoeveel u kunt terugkrijgen van Box 3.

**Nog vragen over het uploaden?**
Neem gerust contact met ons op.

Beantwoord deze e-mail met uw aangifte als bijlage.

Met vriendelijke groet,

Box 3 Team
```

2. **Add Note** - `[BOX3_FLOW] Reminder 1 verzonden: Documenten nog niet ontvangen (2 dagen)`

---

## ⏰ Workflow 7: Document Reminder 2 (7 days)

**Name:** `Box3 - 7. Reminder 2: Docs Not Received (7 days)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Has Tag** - `DOCS_REQUESTED`
2. **Does NOT have Tag** - `DOCS_RECEIVED`
3. **Waiting** - Longer than 7 days

### Actions:
1. **Email Customer** - Subject: `Laatste herinnering: Uw aangifte ontbreekt`
   - Body:
```
Beste {{customer.name}},

Wij hebben na 7 dagen nog steeds geen aangifte ontvangen.

**Heeft u problemen met uploaden?**
Neem contact op - wij helpen graag!

**Wilt u niet meer verder?**
Laat het ons weten, dan sluiten wij uw aanvraag af.

**Wilt u toch doorgaan?**
Stuur uw aangifte als bijlage in een antwoord op deze e-mail.

Met vriendelijke groet,

Box 3 Team
```

2. **Add Note** - `[BOX3_FLOW] Reminder 2 verzonden: Documenten nog niet ontvangen (7 dagen) - Laatste kans`

---

## 📧 Workflow 8: Dynamic Questions Email

**Name:** `Box3 - 8. Email 3: Dynamic Questions`
**Type:** Automatic
**Max Executions:** 1

### Conditions:
1. **Has Tag** - `QUESTIONS_PREPARED` (manually added by Intake Agent)

### Actions:
1. **Email Customer** - Subject: `Email 3: Aanvullende vragen op basis van uw aangifte`
   - Body: *(See full email in JSON file - includes WONING, BELEGGINGEN, SPAARGELD, SCHULDEN sections)*
2. **Add Tag** - `QUESTIONS_SENT`
3. **Add Note** - `[BOX3_STATE] Status: QUESTIONS_PREPARED → QUESTIONS_SENT\n[BOX3_FLOW] Email 3 verzonden: Aanvullende vragen`

---

## 📬 Workflow 9: Route to Fiscalist

**Name:** `Box3 - 9. Route: QUESTIONS_ANSWERED → Fiscalist`
**Type:** Automatic
**Max Executions:** 1

### Conditions:
1. **Has Tag** - `QUESTIONS_ANSWERED`

### Actions:
1. **Add Note** - `[BOX3_STATE] Status: QUESTIONS_ANSWERED\n[BOX3_FLOW] Vragen beantwoord - Fiscalist moet definitief voorstel maken`
2. **Assign to User** - Quote Agent/Fiscalist (ID: 23)
3. **Set Status** - Active (1)
4. **Send Notification** - To assignee

---

## 💰 Workflow 10: Final Offer Email

**Name:** `Box3 - 10. Email 4: Offer & Payment (OFFER_READY)`
**Type:** Automatic
**Max Executions:** 1

### Conditions:
1. **Has Tag** - `OFFER_READY` (manually added by Fiscalist)

### Actions:
1. **Email Customer** - Subject: `Uw voorstel & akkoord voor Box 3 bezwaar`
   - Body: *(See full email in JSON file - includes [MIN], [MAX], [FEE] placeholders)*
2. **Add Tag** - `OFFER_SENT`
3. **Add Note** - `[BOX3_STATE] Status: OFFER_READY → OFFER_SENT\n[BOX3_FLOW] Email 4 verzonden: Definitief voorstel & betaallink`
4. **Assign to User** - Payment Agent (ID: 26)

---

## ⏰ Workflow 11: Offer Reminder 1 (3 days)

**Name:** `Box3 - 11. Reminder 1: Offer Not Accepted (3 days)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Has Tag** - `OFFER_SENT`
2. **Does NOT have Tag** - `PAYMENT_STARTED`
3. **Waiting** - Longer than 3 days

### Actions:
1. **Email Customer** - Subject: `Herinnering: Uw voorstel wacht op akkoord`
2. **Add Note** - `[BOX3_FLOW] Reminder 1 verzonden: Voorstel niet geaccepteerd (3 dagen)`

---

## ⏰ Workflow 12: Offer Reminder 2 (10 days)

**Name:** `Box3 - 12. Reminder 2: Final Offer Reminder (10 days)`
**Type:** Automatic
**Max Executions:** 1

### Conditions (ALL must match):
1. **Has Tag** - `OFFER_SENT`
2. **Does NOT have Tag** - `PAYMENT_STARTED`
3. **Waiting** - Longer than 10 days

### Actions:
1. **Email Customer** - Subject: `Laatste herinnering: Hulp nodig met uw beslissing?`
2. **Add Note** - `[BOX3_FLOW] Reminder 2 verzonden: Voorstel niet geaccepteerd (10 dagen) - Laatste kans`

---

## ❌ Workflow 13: Closed Lost

**Name:** `Box3 - 13. Route: CLOSED_LOST`
**Type:** Automatic
**Max Executions:** 999

### Conditions:
1. **Has Tag** - `CLOSED_LOST`

### Actions:
1. **Email Customer** - Subject: `Bedankt voor uw overweging`
2. **Add Note** - `[BOX3_STATE] Status: CLOSED_LOST\n[BOX3_FLOW] Klant heeft aangegeven niet verder te willen - Afsluitmail verzonden`
3. **Set Status** - Closed (3)

---

## ✅ Workflow 14: Proposal Accepted

**Name:** `Box3 - 14. Route: Proposal Accepted → Payment`
**Type:** Automatic
**Max Executions:** 999

### Conditions:
1. **Has Tag** - `Proposal_Accepted`

### Actions:
1. **Email Customer** - Subject: `Akkoord ontvangen - Ondertekenen & betalen`
2. **Add Tag** - `PAYMENT_STARTED`
3. **Add Note** - `[BOX3_STATE] Proposal_Accepted → PAYMENT_STARTED\n[BOX3_FLOW] Email verzonden met onderteken & betaallink`
4. **Assign to User** - Payment Agent (ID: 26)

---

## 💳 Workflow 15: Payment Confirmation

**Name:** `Box3 - 15. Email 5: Payment & Assignment Confirmation (SIGNED_AND_PAID)`
**Type:** Automatic
**Max Executions:** 1

### Conditions:
1. **Has Tag** - `SIGNED_AND_PAID`

### Actions:
1. **Email Customer** - Subject: `Bevestiging: Opdracht & Betaling Ontvangen`
   - Body:
```
Beste {{customer.name}},

Hartelijk dank! Wij hebben uw ondertekende opdracht en betaling in goede orde ontvangen.

**Overzicht:**

📅 **Datum betaling:** {{payment_date}}
💶 **Betaald bedrag:** € {{payment_amount}}
🔖 **Referentienummer:** {{reference_number}}

**Wat gebeurt er nu?**

Onze fiscalisten gaan direct aan de slag met uw dossier. U hoeft voorlopig niets te doen.

**U ontvangt bericht zodra:**
- Wij uw bezwaarschrift hebben ingediend
- De Belastingdienst heeft gereageerd
- Er aanvullende informatie nodig is

**Vragen?**
Neem gerust contact met ons op. Wij houden u op de hoogte van alle ontwikkelingen.

Met vriendelijke groet,

Box 3 Team

---
*Verwachte doorlooptijd: 2-4 weken voor eerste actie bij Belastingdienst*
```

2. **Add Note** - `[BOX3_STATE] SIGNED_AND_PAID\n[BOX3_FLOW] Email 5 verzonden: Bevestiging betaling & opdracht\n[BOX3_FLOW] Klant is volledig onboarded - Fiscalist kan aan de slag`
3. **Set Status** - Active (2)

---

## 🤖 Workflow 16: AI Draft Generator

**Name:** `Box3 - 16. AI Draft: Generate Reply for Agent`
**Type:** Automatic
**Max Executions:** 999

### Conditions (ALL must match):
1. **Assigned User** - Is NOT unassigned (-1)
2. **Customer Reply** - In last 5 minutes
3. **Conversation Type** - Is reply

### Actions:
1. **Webhook** - POST to `http://localhost:3000/webhook/generate-draft`
   - Payload: `{"conversation_id": "{{conversation.id}}", "assigned_user_id": "{{conversation.user_id}}"}`
2. **Add Note** - `[AI_DRAFT] Webhook called to generate draft reply for agent review`

---

## 🎯 Manual Triggers

### For Intake Agent (ID: 22)
When ready to send questions to customer:
1. Manually add tag: `QUESTIONS_PREPARED`
2. Workflow 8 will automatically send Email 3

### For Fiscalist (ID: 23)
When offer is ready:
1. Fill in placeholders: [MIN], [MAX], [FEE], [NET_MIN], [NET_MAX], [HOOG/MIDDEL/LAAG]
2. Manually add tag: `OFFER_READY`
3. Workflow 10 will automatically send Email 4

---

## 🔗 Webhook Endpoints

Make sure webhook server is running: `npm start`

- **Welcome Email:** `http://localhost:3000/webhook/generate-welcome`
- **Intent Detection:** `http://localhost:3000/webhook/detect-intent`
- **Draft Generation:** `http://localhost:3000/webhook/generate-draft`
- **Payment Confirmation:** `http://localhost:3000/webhook/signed-and-paid`

---

## ✅ Testing Checklist

After creating all workflows:

1. [ ] Test new conversation → Welcome email generated
2. [ ] Test upload request sent after 2 minutes
3. [ ] Test attachment detection sets DOCS_RECEIVED
4. [ ] Test Intake agent assignment
5. [ ] Test QUESTIONS_PREPARED tag → Email 3 sent
6. [ ] Test OFFER_READY tag → Email 4 sent
7. [ ] Test reminders trigger correctly
8. [ ] Test SIGNED_AND_PAID webhook → Email 5 sent
9. [ ] Test AI draft generation for agent replies
10. [ ] Test intent detection for customer replies

---

## 📝 Notes

- All email bodies are in Dutch unless customer writes in English
- Placeholders like {{customer.name}} are auto-filled by FreeScout
- Tags are case-sensitive
- Webhook server must be running for webhooks to work
- Agent IDs: Intake=22, Fiscalist=23, Onboarding=25, Payment=26
