# Feature 3 – Campaign Scheduling & Sending

## Setup

```bash
cd feature3
cp .env.example .env          # then fill in your RESEND_API_KEY
npm install
npm run dev
```

The server starts on **http://localhost:3000**.

---

## Step 1 – Create a contact

```bash
curl -s -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "firstName": "Alice",
    "lastName": "Smith",
    "tags": ["newsletter"],
    "subscribed": true
  }' | jq
```

Copy the returned `id` – you'll use it later.

---

## Step 2 – Create a template

```bash
curl -s -X POST http://localhost:3000/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome email",
    "subject": "Hi {{first_name}}, welcome!",
    "htmlBody": "<p>Hey {{first_name}} {{last_name}}, glad to have you.</p>",
    "variables": ["first_name", "last_name"]
  }' | jq
```

Copy the returned template `id`.

---

## Step 3 – Create a campaign (draft)

```bash
curl -s -X POST http://localhost:3000/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "March newsletter",
    "templateId": "<TEMPLATE_ID>",
    "targetTags": ["newsletter"]
  }' | jq
```

Copy the campaign `id`.

---

## Step 4a – Send immediately

```bash
curl -s -X POST http://localhost:3000/campaigns/<CAMPAIGN_ID>/send-now | jq
```

The API returns `202 Accepted` immediately; sending happens in the background.

---

## Step 4b – Schedule for later

```bash
curl -s -X PATCH http://localhost:3000/campaigns/<CAMPAIGN_ID>/schedule \
  -H "Content-Type: application/json" \
  -d '{"scheduledAt": "2026-03-25T15:00:00Z"}' | jq
```

The background cron checks every 60 seconds and dispatches any due campaigns.

---

## Step 5 – Check campaign status

```bash
curl -s http://localhost:3000/campaigns/<CAMPAIGN_ID>/status | jq
```

Returns `status`, `sentCount`, `failedCount`, and a `logSummary`.

---

## Notes

- **Rate limiting**: Resend free tier allows 1 email/second. The dispatcher waits 1.1 s between sends and retries with exponential backoff on 429 errors.
- **Tag filtering**: If `targetTags` is empty, the campaign sends to all subscribed contacts.
- **Interpolation**: Template variables (`{{first_name}}` etc.) are filled from the contact's `first_name`, `last_name`, and `email` fields.
