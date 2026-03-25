# How to Test — Feature 2: Email Templates

Follow every step in order. All commands have both Windows and Mac/Linux versions.

---

## SETUP (do this once)

### Step 1 — Install and start

Open a terminal in this folder:
```
npm install
npm run dev
```

You should see:
```
[db] Database ready at ./data/app.db
✅ Server running at http://localhost:3000
```

**Keep this terminal open. Open a second terminal for all tests below.**

---

## FEATURE 2 TESTS — Email Templates

---

### TEST 1 — Create a template with variables

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates" -Method POST -ContentType "application/json" -Body '{"name":"Welcome Email","subject":"Welcome to our store, {{first_name}}!","htmlBody":"<h1>Hi {{first_name}} {{last_name}},</h1><p>Thanks for joining us at {{company}}. Your account is ready.</p><p>Best,<br>The Team</p>","variables":["first_name","last_name","company"]}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Email",
    "subject": "Welcome to our store, {{first_name}}!",
    "htmlBody": "<h1>Hi {{first_name}} {{last_name}},</h1><p>Thanks for joining us at {{company}}. Your account is ready.</p><p>Best,<br>The Team</p>",
    "variables": ["first_name", "last_name", "company"]
  }'
```

✅ **Expected result:** Status 201. You get back a template object with an `id`. **Copy that `id` — you'll need it for the next tests.**

---

### TEST 2 — Create a second template (promo email)

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates" -Method POST -ContentType "application/json" -Body '{"name":"Promo Email","subject":"{{first_name}}, your exclusive deal expires soon!","htmlBody":"<h2>Hey {{first_name}},</h2><p>Use code <strong>{{promo_code}}</strong> for {{discount}}% off your next order.</p>","variables":["first_name","promo_code","discount"]}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promo Email",
    "subject": "{{first_name}}, your exclusive deal expires soon!",
    "htmlBody": "<h2>Hey {{first_name}},</h2><p>Use code <strong>{{promo_code}}</strong> for {{discount}}% off your next order.</p>",
    "variables": ["first_name", "promo_code", "discount"]
  }'
```

✅ **Expected result:** Status 201, second template created.

---

### TEST 3 — List all templates

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/templates
```

✅ **Expected result:** Array with both templates you created.

---

### TEST 4 — Get a single template by ID

Replace `PASTE_ID_HERE` with the `id` from Test 1.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/templates/PASTE_ID_HERE
```

✅ **Expected result:** Just that one template object.

---

### TEST 5 — Preview a template with sample data

This is the key Feature 2 endpoint — it fills in the `{{variable}}` placeholders and returns the rendered email.

Replace `PASTE_ID_HERE` with the id from Test 1 (the Welcome Email).

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE/preview" -Method POST -ContentType "application/json" -Body '{"first_name":"Alice","last_name":"Smith","company":"Acme Corp"}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/templates/PASTE_ID_HERE/preview \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Alice",
    "last_name": "Smith",
    "company": "Acme Corp"
  }'
```

✅ **Expected result:**
```json
{
  "data": {
    "subject": "Welcome to our store, Alice!",
    "html": "<h1>Hi Alice Smith,</h1><p>Thanks for joining us at Acme Corp. Your account is ready.</p><p>Best,<br>The Team</p>",
    "resolved": ["first_name", "last_name", "company"],
    "unresolved": []
  }
}
```

Notice how `{{first_name}}`, `{{last_name}}` and `{{company}}` were all replaced!

---

### TEST 6 — Preview with a missing variable (partial render)

Try the preview but leave out `company` to see what happens with unresolved variables.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE/preview" -Method POST -ContentType "application/json" -Body '{"first_name":"Bob","last_name":"Jones"}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/templates/PASTE_ID_HERE/preview \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Bob", "last_name": "Jones"}'
```

✅ **Expected result:**
```json
{
  "data": {
    "subject": "Welcome to our store, Bob!",
    "html": "<h1>Hi Bob Jones,</h1><p>Thanks for joining us at {{company}}. Your account is ready.</p>...",
    "resolved": ["first_name", "last_name"],
    "unresolved": ["company"]
  }
}
```

`{{company}}` stays in the HTML because you didn't supply it. The `unresolved` array tells you what's missing.

---

### TEST 7 — Update a template

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE" -Method PUT -ContentType "application/json" -Body '{"name":"Welcome Email v2","subject":"Hi {{first_name}}, welcome aboard!"}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X PUT http://localhost:3000/templates/PASTE_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"name": "Welcome Email v2", "subject": "Hi {{first_name}}, welcome aboard!"}'
```

✅ **Expected result:** Template returned with updated `name` and `subject`. Other fields (htmlBody, variables) are unchanged.

---

### TEST 8 — Send invalid data (should be rejected)

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates" -Method POST -ContentType "application/json" -Body '{"name":""}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/templates \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
```

❌ **Expected result:** Status 400 with field-level errors:
```json
{
  "error": "Validation failed",
  "details": {
    "name": ["name is required"],
    "subject": ["Required"],
    "htmlBody": ["Required"]
  }
}
```

---

### TEST 9 — Get a template that doesn't exist

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/fake-id-123" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/templates/fake-id-123
```

❌ **Expected result:** Status 404:
```json
{ "error": "Template not found" }
```

---

### TEST 10 — Delete a template

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE" -Method DELETE
```

**Mac / Linux:**
```bash
curl -X DELETE http://localhost:3000/templates/PASTE_ID_HERE
```

✅ **Expected result:** Empty response, status 204.

Then confirm it's gone:

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/templates/PASTE_ID_HERE" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/templates/PASTE_ID_HERE
```

❌ **Expected:** `{ "error": "Template not found" }`

---

## BONUS — Also test Feature 1 contacts still work

The contacts endpoints from Feature 1 are included in this build too.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/contacts
```

✅ **Expected result:** Empty array `{ "data": [] }` — contacts still work fine alongside templates.

---

## All 10 tests passed? Feature 2 is complete ✅

---

## Troubleshooting

**PowerShell returns a red error on 4xx responses**
Add `-ErrorAction SilentlyContinue` to see the body:
```powershell
Invoke-WebRequest ... -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
```

**"Cannot connect" / "Connection refused"**
→ Server isn't running. Run `npm run dev` in your other terminal.

**"npm install" fails**
→ Delete the `node_modules` folder and try again.
