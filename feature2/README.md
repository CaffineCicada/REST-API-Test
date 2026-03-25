# Feature 2 — Email Templates

Builds on Feature 1. Both `/contacts` and `/templates` endpoints are available.

## Quick Start
```
npm install
npm run dev
```

Open **HOW_TO_TEST.md** for step-by-step instructions with Windows PowerShell + Mac/Linux curl commands.

## Endpoints

### Templates (new in Feature 2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List all templates |
| GET | `/templates/:id` | Get one template |
| POST | `/templates` | Create a template |
| PUT | `/templates/:id` | Update a template |
| DELETE | `/templates/:id` | Delete a template |
| POST | `/templates/:id/preview` | Render template with sample data |

### Contacts (carried over from Feature 1)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/contacts` | List all contacts |
| GET | `/contacts/:id` | Get one contact |
| POST | `/contacts` | Create a contact |
| PUT | `/contacts/:id` | Update a contact |
| DELETE | `/contacts/:id` | Delete a contact |
| POST | `/contacts/import` | Bulk upsert |
