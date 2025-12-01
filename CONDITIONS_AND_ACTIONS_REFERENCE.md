# Workflows: Complete Conditions and Actions Reference

## Overview

This document provides a comprehensive reference for all available conditions and actions in the FreeScout Workflows module. Use this guide to understand what each condition checks and what each action does.

---

## Table of Contents

1. [Conditions Reference](#conditions-reference)
   - [People Conditions](#people-conditions)
   - [Conversation Conditions](#conversation-conditions)
   - [Date/Time Conditions](#datetime-conditions)
2. [Actions Reference](#actions-reference)
   - [Email Actions](#email-actions)
   - [Conversation Management Actions](#conversation-management-actions)
   - [Integration Actions](#integration-actions)

---

## Conditions Reference

Conditions determine **when** a workflow should trigger. Multiple conditions can be combined using AND/OR logic.

### People Conditions

#### Customer Name
Check the customer's full name.

**Operators:**
- **Is equal to**: Exact match (case-insensitive)
- **Contains**: Name contains the specified text
- **Does not contain**: Name does not contain the specified text
- **Is not equal to**: Not an exact match
- **Starts with**: Name begins with the specified text
- **Ends with**: Name ends with the specified text
- **Matches regex pattern**: Advanced pattern matching

**Example Use Cases:**
- Route conversations from VIP customers
- Identify customers from specific companies
- Filter by customer naming conventions

---

#### Customer Email
Check the customer's email address.

**Operators:**
- **Is equal to**: Exact email match
- **Contains**: Email contains the specified text
- **Does not contain**: Email does not contain the specified text
- **Is not equal to**: Not an exact email match
- **Starts with**: Email begins with the specified text
- **Ends with**: Email ends with the specified text (useful for domains)
- **Matches regex pattern**: Advanced pattern matching

**Example Use Cases:**
- Route all emails from `@enterprise.com` to specific users
- Identify internal vs. external customers
- Apply VIP handling for specific domains

---

#### User Action
Check which user performed an action.

**Operators:**
- **Replied**: User sent a reply
- **Noted**: User added a note

**Values:**
- Specific user ID
- **Any User** (-1): Any user performed the action

**Example Use Cases:**
- Trigger actions when specific agents reply
- Track when notes are added by managers
- Create follow-up workflows based on user activity

---

### Conversation Conditions

#### Type
Check the conversation type.

**Operators:**
- **Is equal to**
- **Is not equal to**

**Values:**
- **Email** (1)
- **Phone** (2)
- **Chat** (3)

**Example Use Cases:**
- Apply different SLAs for phone vs. email
- Route chat conversations differently
- Set priority based on communication channel

---

#### Status
Check the conversation status.

**Operators:**
- **Is equal to**
- **Is not equal to**

**Values:**
- **Active** (1): Open and actively being worked on
- **Pending** (2): Waiting for customer response
- **Closed** (3): Resolved and closed
- **Spam** (4): Marked as spam

**Example Use Cases:**
- Close old pending conversations
- Escalate active conversations after a time period
- Prevent actions on spam conversations

---

#### State
Check the conversation state (internal status).

**Operators:**
- **Is equal to**
- **Is not equal to**

**Values:**
- **Draft** (1): Not yet sent
- **Published** (2): Visible to customer
- **Deleted** (3): In trash

**Example Use Cases:**
- Process only published conversations
- Skip deleted conversations
- Handle draft cleanup

---

#### Assigned User
Check who the conversation is assigned to.

**Operators:**
- **Is equal to**
- **Is not equal to**

**Values:**
- Specific user ID
- **Unassigned** (-1): No user assigned

**Example Use Cases:**
- Reassign unassigned conversations
- Notify when assigned to specific users
- Balance workload across team members

---

#### To (Email Address)
Check the "To" field in the email.

**Operators:**
- **Is equal to**
- **Contains**
- **Does not contain**
- **Is not equal to**
- **Starts with**
- **Ends with**
- **Matches regex pattern**

**Example Use Cases:**
- Route emails to billing@, support@, sales@ differently
- Identify group emails
- Catch-all routing rules

---

#### CC (Email Address)
Check the "CC" field in the email.

**Operators:**
- **Is equal to**
- **Contains**
- **Does not contain**
- **Is not equal to**
- **Starts with**
- **Ends with**
- **Matches regex pattern**

**Example Use Cases:**
- Flag conversations with management in CC
- Track when specific addresses are CC'd
- Escalate based on CC recipients

---

#### Subject
Check the email subject line.

**Operators:**
- **Is equal to**
- **Contains**
- **Does not contain**
- **Is not equal to**
- **Starts with**
- **Ends with**
- **Matches regex pattern**

**Example Use Cases:**
- Identify urgent messages
- Route by order numbers in subject
- Categorize by subject keywords
- Filter automated emails

---

#### Body
Check the message body content.

**Operators:**
- **Customer**: Message from customer contains text
- **Note**: Internal note contains text
- **Matches regex pattern**: Advanced pattern matching

**Example Use Cases:**
- Detect refund requests in customer messages
- Find specific product mentions
- Identify escalation keywords
- Track internal notes with specific tags

---

#### Headers
Check email headers (technical email metadata).

**Operators:**
- **Contains**
- **Does not contain**
- **Matches regex pattern**

**Example Use Cases:**
- Check for priority flags (X-Priority)
- Identify automated emails
- Route based on mail server information
- Detect specific email clients

---

#### Attachment
Check if the conversation has attachments.

**Operators:**
- **Yes**: Has one or more attachments
- **No**: No attachments

**Example Use Cases:**
- Require review for conversations with attachments
- Flag large attachments
- Route document submissions differently

---

#### Bounce
Check if the email is a bounce message.

**Operators:**
- **Yes**: Is a bounce email
- **No**: Not a bounce email

**Example Use Cases:**
- Automatically mark bounces as spam
- Track delivery failures
- Clean up bounce messages
- Notify admins of bounce patterns

---

#### Customer Viewed
Check if the customer has opened/viewed the message.

**Operators:**
- **Yes**: Customer opened the message
- **No**: Customer has not opened the message

**Example Use Cases:**
- Follow up on unread messages
- Track customer engagement
- Escalate if not viewed within timeframe
- Measure response effectiveness

---

#### Has Draft
Check if the conversation has a draft reply.

**Operators:**
- **Yes**: Has a draft reply
- **No**: No draft reply exists

**Example Use Cases:**
- Only create AI drafts if none exist
- Remind agents about pending drafts
- Track conversations with unsent responses
- Prevent duplicate draft creation

---

#### New/Reply/Moved
Check the trigger type for the conversation.

**Operators:**
- **New conversation created**: Brand new conversation
- **User or customer replied**: New message added
- **Moved to this mailbox**: Transferred from another mailbox

**Example Use Cases:**
- Auto-assign only new conversations
- Different handling for replies vs. new tickets
- Process moved conversations differently

---

#### Channel
Check the communication channel (requires custom module).

**Operators:**
- **Is equal to**
- **Is not equal to**

**Values:**
- Channel ID from installed channel modules

**Example Use Cases:**
- Route Facebook messages differently
- Apply different SLAs per channel
- Track channel-specific metrics

---

### Date/Time Conditions

#### Waiting Since
Check how long since the last customer reply.

**Operators:**
- **Longer than**: More time has passed
- **Not longer than**: Less time has passed

**Values:**
- Number + Metric (hours/days)

**Requirements:**
- Conversation status must be Active or Pending
- Last reply must be from customer

**Example Use Cases:**
- Escalate after 24 hours without response
- Send follow-up reminders
- Track SLA compliance
- Close old pending conversations

---

#### Last User Reply
Check when the last user (agent) reply was sent.

**Operators:**
- **In last**: Reply was within the specified time
- **Not in last**: Reply was NOT within the specified time

**Values:**
- Number + Metric (hours/days)

**Example Use Cases:**
- Track response times
- Identify stale conversations
- Ensure timely follow-ups
- Monitor agent activity

---

#### Last Customer Reply
Check when the last customer reply was received.

**Operators:**
- **In last**: Reply was within the specified time
- **Not in last**: Reply was NOT within the specified time

**Values:**
- Number + Metric (hours/days)

**Example Use Cases:**
- Auto-close if no customer response in 14 days
- Identify engaged customers
- Track abandoned conversations
- Schedule follow-ups

---

#### Date Created
Check when the conversation was created.

**Operators:**
- **In last**: Created within the specified time
- **Not in last**: NOT created within the specified time

**Values:**
- Number + Metric (hours/days)

**Example Use Cases:**
- Process only recent conversations
- Bulk operations on old conversations
- Track aging tickets
- Generate time-based reports

---

## Actions Reference

Actions determine **what happens** when workflow conditions are met.

### Email Actions

#### Send Email Notification
Send a notification email to specific users.

**Recipients:**
- Specific user IDs
- **Current Assignee**: Whoever is assigned to the conversation
- **Last User to Reply**: The last agent who responded

**Example Use Cases:**
- Notify manager when VIP customer contacts
- Alert team about urgent conversations
- Escalation notifications
- SLA breach alerts

---

#### Reply to Conversation
Send a reply to the customer from the conversation thread.

**Options:**
- **Body**: Reply message text (supports variables)
- **CC**: Carbon copy recipients
- **BCC**: Blind carbon copy recipients
- **Include conversation history**: Attach previous messages
- **Conversation history format**: How to format history

**Template Variables:**
- `{{customer.name}}` - Customer's full name
- `{{customer.firstName}}` - Customer's first name
- `{{customer.lastName}}` - Customer's last name
- `{{customer.email}}` - Customer's email
- `{{user.name}}` - Assigned user's name
- `{{user.firstName}}` - User's first name
- `{{user.lastName}}` - User's last name
- `{{user.email}}` - User's email
- `{{conversation.number}}` - Conversation number
- `{{conversation.subject}}` - Conversation subject
- `{{mailbox.name}}` - Mailbox name
- `{{mailbox.email}}` - Mailbox email

**Example Use Cases:**
- Auto-reply acknowledgments
- Send templated responses
- After-hours notifications
- Status update confirmations

---

#### Reply with AI
Generate an AI-powered reply (optionally as draft).

**Options:**
- **Body**: Optional AI instructions/prompt
- **Create as draft**: Create as draft (default: true) or send immediately

**How it works:**
- When **draft mode enabled** (default):
  - Creates a draft reply that can be reviewed and edited
  - Only creates draft if one doesn't already exist
  - Agents can review and modify before sending
- When **draft mode disabled**:
  - Sends AI-generated reply immediately
  - No manual review step

**AI Instructions Examples:**
- "Respond professionally and offer a refund"
- "Ask for more details about the issue"
- "Provide troubleshooting steps for the reported problem"
- Leave empty to use default AI behavior

**Example Use Cases:**
- Reduce agent workload with AI-suggested responses
- Generate initial drafts for common inquiries
- Maintain consistent tone across responses
- Speed up response times
- Provide 24/7 automated responses

**Template Variables:**
All the same variables as "Reply to Conversation" can be used in AI instructions.

---

#### Email the Customer
Send a standalone email to the customer (separate from conversation thread).

**Options:**
- **Subject**: Email subject line
- **Body**: Email message text (supports variables)
- **CC**: Carbon copy recipients
- **BCC**: Blind carbon copy recipients
- **Conversation history**: Include conversation history

**Example Use Cases:**
- Send confirmation emails
- Proactive updates
- Subscription notifications
- Survey requests

---

#### Disable Auto Reply
Prevent automatic reply emails from being sent.

**Example Use Cases:**
- Skip auto-replies for internal emails
- Prevent replies to automated messages
- Disable for specific customer domains
- Control reply behavior for bulk emails

---

#### Forward
Forward the conversation to another email address.

**Options:**
- **To**: Recipient email address
- **CC**: Carbon copy recipients
- **BCC**: Blind carbon copy recipients
- **Body**: Optional message to include

**Example Use Cases:**
- Forward to external systems
- Send to specialized departments
- Escalate to management
- Archive to external storage

---

### Conversation Management Actions

#### Add a Note
Add an internal note to the conversation (not visible to customer).

**Options:**
- **Body**: Note text (supports variables)

**Example Use Cases:**
- Log workflow actions
- Track automated changes
- Add context for agents
- Document escalations
- Audit trail

---

#### Change Status
Update the conversation status.

**Values:**
- **Active** (1): Open and active
- **Pending** (2): Waiting for customer
- **Closed** (3): Resolved
- **Spam** (4): Mark as spam

**Example Use Cases:**
- Auto-close resolved conversations
- Set to pending after reply
- Mark bounces as spam
- Reopen closed conversations

---

#### Assign to User
Assign the conversation to a specific user.

**Values:**
- Specific user ID
- **Unassigned** (-1): Remove assignment
- **Current user** (-10): User running the workflow (manual workflows)

**Example Use Cases:**
- Round-robin assignment
- Route by expertise
- Load balancing
- VIP customer assignment
- Skill-based routing

---

#### Move to Mailbox
Transfer the conversation to another mailbox.

**Values:**
- Target mailbox ID

**Example Use Cases:**
- Route to specialized teams
- Reorganize mailbox structure
- Separate by product/service
- Regional routing

---

#### Move to Deleted Folder
Soft-delete the conversation (can be recovered).

**Example Use Cases:**
- Clean up spam
- Archive old conversations
- Remove test conversations
- Bulk cleanup

---

#### Delete Forever
Permanently delete the conversation (cannot be recovered).

**WARNING**: This action is irreversible.

**Example Use Cases:**
- GDPR/data deletion requests
- Remove sensitive information
- Clean up test data
- Compliance requirements

---

### Integration Actions

#### Webhook
Trigger a custom webhook event for external integrations.

**Options:**
- **Custom event name**: Unique identifier for your webhook

**Example Use Cases:**
- Trigger external systems
- Send to CRM
- Update billing systems
- Notify Slack/Teams
- Create tasks in project management tools
- Send SMS alerts
- Log to analytics platforms

**Event Naming Convention:**
- `workflow.convo.[purpose]` - Conversation-related events
- `workflow.customer.[purpose]` - Customer-related events

**Examples:**
- `workflow.convo.urgent.escalation`
- `workflow.convo.vip.customer`
- `workflow.convo.sla.breach`

See [WORKFLOW_WEBHOOK_ACTIONS_GUIDE.md](WORKFLOW_WEBHOOK_ACTIONS_GUIDE.md) for detailed webhook integration instructions.

---

## Using Template Variables

Many actions support template variables that are automatically replaced with actual values:

### Customer Variables
- `{{customer.fullName}}` or `{{customer.name}}` - Full name
- `{{customer.firstName}}` - First name only
- `{{customer.lastName}}` - Last name only
- `{{customer.email}}` - Email address
- `{{customer.phone}}` - Phone number

### User Variables
- `{{user.name}}` - Assigned user's full name
- `{{user.firstName}}` - User's first name
- `{{user.lastName}}` - User's last name
- `{{user.email}}` - User's email

### Conversation Variables
- `{{conversation.number}}` - Conversation ID number
- `{{conversation.subject}}` - Email subject
- `{{conversation.status}}` - Current status

### Mailbox Variables
- `{{mailbox.name}}` - Mailbox name
- `{{mailbox.email}}` - Mailbox email address

### Example Usage
```
Hello {{customer.firstName}},

Thank you for contacting {{mailbox.name}} regarding {{conversation.subject}}.

Best regards,
{{user.name}}
```

---

## Workflow Logic: AND vs. OR

### AND Logic (Between Groups)
Multiple condition groups are connected with AND logic - ALL groups must be true.

**Example:**
```
[Group 1: Subject contains "urgent" OR "critical"]
AND
[Group 2: Status is Active]
```
Both groups must match.

### OR Logic (Within Groups)
Conditions within the same group are connected with OR logic - ANY condition can be true.

**Example:**
```
[Subject contains "urgent" OR Subject contains "critical"]
```
Either condition can match.

---

## Quick Reference: Common Workflow Patterns

### Pattern: Auto-Assign by Keyword
**Conditions:**
- New/Reply: New conversation created
- Subject: Contains "billing" OR "invoice" OR "payment"

**Actions:**
- Assign to User: Billing team member
- Add Note: "Auto-routed to billing"

---

### Pattern: SLA Escalation
**Conditions:**
- Waiting Since: Longer than 24 hours
- Status: Is Active

**Actions:**
- Send Notification: Manager
- Add Note: "SLA breach - escalated"
- Change Status: Active (ensure it stays active)

---

### Pattern: Auto-Close Old Pending
**Conditions:**
- Status: Is Pending
- Last Customer Reply: Not in last 14 days

**Actions:**
- Reply: "We haven't heard from you. Closing this ticket."
- Change Status: Closed
- Add Note: "Auto-closed due to inactivity"

---

### Pattern: VIP Customer Handling
**Conditions:**
- Customer Email: Ends with "@vip-domain.com"

**Actions:**
- Assign to User: Senior agent
- Send Notification: Manager + Assignee
- Add Note: "VIP customer - priority handling"

---

### Pattern: AI-Assisted Responses
**Conditions:**
- New/Reply: New conversation created
- Has Draft: No

**Actions:**
- Reply with AI: "Analyze the message and provide a helpful response" (as draft)
- Assign to User: Next available agent

---

## Tips and Best Practices

### Condition Tips
1. **Start simple**: Begin with one or two conditions
2. **Test thoroughly**: Use inactive workflows to test before enabling
3. **Use specific conditions first**: Place most restrictive conditions in early groups
4. **Avoid conflicts**: Ensure workflows don't contradict each other

### Action Tips
1. **Order matters**: Actions execute in order from top to bottom
2. **Add notes**: Document what the workflow did for audit trail
3. **Test notifications**: Verify notification recipients have access
4. **Use variables**: Make replies dynamic with template variables
5. **Review AI drafts**: Always review AI-generated content before sending

### Performance Tips
1. **Limit date conditions**: Date-based workflows impact performance
2. **Use max_executions**: Prevent infinite loops
3. **Optimize regex**: Complex patterns slow down processing
4. **Sort order**: Critical workflows should have lower sort_order

### Security Tips
1. **Validate input**: Be careful with auto-replies to prevent abuse
2. **Check permissions**: Ensure assigned users have mailbox access
3. **Audit regularly**: Review workflow actions in notes
4. **Limit auto-send**: Use draft mode for AI replies when possible

---

## Additional Resources

- **[WORKFLOWS_API_DOCUMENTATION.md](WORKFLOWS_API_DOCUMENTATION.md)** - Complete API reference
- **[AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md)** - Guide for AI agents and automation systems
- **[WORKFLOW_WEBHOOK_ACTIONS_GUIDE.md](WORKFLOW_WEBHOOK_ACTIONS_GUIDE.md)** - Webhook integration guide
- **FreeScout Docs**: https://automail.ciphix.dev/module/workflows/

---

**Last Updated**: 2025-12-01
**Version**: 1.0
