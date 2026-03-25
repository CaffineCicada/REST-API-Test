# How to Test — Contact Management API

Follow these steps in order. Everything is copy-paste ready.

---

## STEP 1 — Install dependencies

Open a terminal in this folder and run:
```
npm install
```
This should complete without errors (no C++ tools needed this time).

---

## STEP 2 — Start the server

```
npm run dev
```

You should see:
```
[db] Database ready at ./data/contacts.db
✅ Server running at http://localhost:3000
```

**Keep this terminal open.** Open a second terminal for the tests below.

---

## STEP 3 — Run the tests

### Windows users: use PowerShell for these commands.
### Mac/Linux users: use Terminal.

---

## TEST 1 — Create a contact

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" -Method POST -ContentType "application/json" -Body '{"email":"alice@example.com","firstName":"Alice","lastName":"Smith","tags":["newsletter","vip"],"subscribed":true}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","firstName":"Alice","lastName":"Smith","tags":["newsletter","vip"],"subscribed":true}'
```

✅ **Expected result:** Status 201, contact object with an `id` field.

---

## TEST 2 — Create a second contact

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" -Method POST -ContentType "application/json" -Body '{"email":"bob@example.com","firstName":"Bob","lastName":"Jones","tags":["newsletter"],"subscribed":true}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","firstName":"Bob","lastName":"Jones","tags":["newsletter"],"subscribed":true}'
```

✅ **Expected result:** Status 201, second contact created.

---

## TEST 3 — List all contacts

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/contacts
```

✅ **Expected result:** Array with both contacts (Alice and Bob).

---

## TEST 4 — Get a single contact

👉 Copy the `id` value from any previous response. It looks like `"id":"abc-123-..."`.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/PASTE_ID_HERE" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/contacts/PASTE_ID_HERE
```

✅ **Expected result:** Just that one contact.

---

## TEST 5 — Update a contact

Use the same ID from Test 4.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/PASTE_ID_HERE" -Method PUT -ContentType "application/json" -Body '{"firstName":"Alicia","tags":["vip"]}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X PUT http://localhost:3000/contacts/PASTE_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Alicia","tags":["vip"]}'
```

✅ **Expected result:** Contact returned with `firstName` updated to "Alicia" and tags changed to `["vip"]`.

---

## TEST 6 — Try to create a duplicate email (should be rejected)

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" -Method POST -ContentType "application/json" -Body '{"email":"alice@example.com","firstName":"Alice","lastName":"Clone"}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","firstName":"Alice","lastName":"Clone"}'
```

❌ **Expected result:** Status 409 with:
```json
{ "error": "A contact with this email already exists" }
```

---

## TEST 7 — Send invalid data (should be rejected)

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts" -Method POST -ContentType "application/json" -Body '{"email":"not-an-email","firstName":""}' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","firstName":""}'
```

❌ **Expected result:** Status 400 with field-level error messages.

---

## TEST 8 — Bulk import

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/import" -Method POST -ContentType "application/json" -Body '[{"email":"carol@example.com","firstName":"Carol","lastName":"White","tags":["vip"],"subscribed":true},{"email":"dave@example.com","firstName":"Dave","lastName":"Brown","tags":[],"subscribed":false}]' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts/import \
  -H "Content-Type: application/json" \
  -d '[{"email":"carol@example.com","firstName":"Carol","lastName":"White","tags":["vip"],"subscribed":true},{"email":"dave@example.com","firstName":"Dave","lastName":"Brown","tags":[],"subscribed":false}]'
```

✅ **Expected result:**
```json
{ "message": "Successfully imported 2 contacts" }
```

Run Test 3 (list all) again — you should now see 4 contacts.

---

## TEST 9 — Re-import to test upsert (no duplicates)

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/import" -Method POST -ContentType "application/json" -Body '[{"email":"carol@example.com","firstName":"Caroline","lastName":"White-Updated","tags":["vip","premium"],"subscribed":true}]' | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl -X POST http://localhost:3000/contacts/import \
  -H "Content-Type: application/json" \
  -d '[{"email":"carol@example.com","firstName":"Caroline","lastName":"White-Updated","tags":["vip","premium"]}]'
```

✅ **Expected result:** Still 4 contacts total, but Carol's name is now "Caroline White-Updated".

---

## TEST 10 — Delete a contact

Use any `id` from your contacts.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/PASTE_ID_HERE" -Method DELETE
```

**Mac / Linux:**
```bash
curl -X DELETE http://localhost:3000/contacts/PASTE_ID_HERE
```

✅ **Expected result:** Empty response with status 204.

---

## TEST 11 — Confirm deletion

Try to fetch the deleted contact.

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/contacts/PASTE_DELETED_ID_HERE" | Select-Object -ExpandProperty Content
```

**Mac / Linux:**
```bash
curl http://localhost:3000/contacts/PASTE_DELETED_ID_HERE
```

❌ **Expected result:** Status 404 with:
```json
{ "error": "Contact not found" }
```

---

## All 11 tests passed? You're done ✅

---

## Troubleshooting

**"Cannot connect" or "Connection refused"**
→ The server isn't running. Go to the other terminal and run `npm run dev`.

**PowerShell returns a red error about status code**
→ That's normal for 4xx errors in PowerShell. Add `-ErrorAction SilentlyContinue` to the end of the command to see the body:
```powershell
Invoke-WebRequest ... -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Content
```

**"npm install" still fails**
→ Try deleting the `node_modules` folder and running `npm install` again.
