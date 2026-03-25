import { Router, Request, Response } from "express";
import { db, persist } from "../db";
import { z } from "zod";
import { randomUUID } from "crypto";

export const contactsRouter = Router();

// ─── Validation ───────────────────────────────────────────────────────────────
const CreateContactSchema = z.object({
  email:      z.string().email("Must be a valid email address"),
  firstName:  z.string().min(1, "firstName is required"),
  lastName:   z.string().min(1, "lastName is required"),
  tags:       z.array(z.string()).default([]),
  subscribed: z.boolean().default(true),
});

const UpdateContactSchema = CreateContactSchema.partial();

// ─── Helper: convert raw DB row to clean object ───────────────────────────────
function rowToContact(row: any) {
  return {
    id:         row.id,
    email:      row.email,
    firstName:  row.first_name,
    lastName:   row.last_name,
    tags:       JSON.parse(row.tags),
    subscribed: row.subscribed === 1,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

// ─── Helper: run a SELECT and return rows as plain objects ────────────────────
function query(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | null {
  const rows = query(sql, params);
  return rows[0] ?? null;
}

// ─── GET /contacts ────────────────────────────────────────────────────────────
contactsRouter.get("/", (_req: Request, res: Response) => {
  const rows = query("SELECT * FROM contacts ORDER BY created_at DESC");
  res.json({ data: rows.map(rowToContact) });
});

// ─── GET /contacts/:id ────────────────────────────────────────────────────────
contactsRouter.get("/:id", (req: Request, res: Response) => {
  const row = queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Contact not found" });
  res.json({ data: rowToContact(row) });
});

// ─── POST /contacts ───────────────────────────────────────────────────────────
contactsRouter.post("/", (req: Request, res: Response) => {
  const result = CreateContactSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
  }

  const { email, firstName, lastName, tags, subscribed } = result.data;

  const existing = queryOne("SELECT id FROM contacts WHERE email = ?", [email]);
  if (existing) {
    return res.status(409).json({ error: "A contact with this email already exists" });
  }

  const id = randomUUID();
  db.run(
    "INSERT INTO contacts (id, email, first_name, last_name, tags, subscribed) VALUES (?, ?, ?, ?, ?, ?)",
    [id, email, firstName, lastName, JSON.stringify(tags), subscribed ? 1 : 0]
  );
  persist();

  const created = queryOne("SELECT * FROM contacts WHERE id = ?", [id]);
  res.status(201).json({ data: rowToContact(created) });
});

// ─── PUT /contacts/:id ────────────────────────────────────────────────────────
contactsRouter.put("/:id", (req: Request, res: Response) => {
  const existing = queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Contact not found" });

  const result = UpdateContactSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
  }

  const u = result.data;
  const newEmail      = u.email      ?? existing.email;
  const newFirstName  = u.firstName  ?? existing.first_name;
  const newLastName   = u.lastName   ?? existing.last_name;
  const newTags       = u.tags       !== undefined ? JSON.stringify(u.tags) : existing.tags;
  const newSubscribed = u.subscribed !== undefined ? (u.subscribed ? 1 : 0) : existing.subscribed;

  db.run(
    `UPDATE contacts
     SET email = ?, first_name = ?, last_name = ?, tags = ?, subscribed = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [newEmail, newFirstName, newLastName, newTags, newSubscribed, req.params.id]
  );
  persist();

  const updated = queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
  res.json({ data: rowToContact(updated) });
});

// ─── DELETE /contacts/:id ─────────────────────────────────────────────────────
contactsRouter.delete("/:id", (req: Request, res: Response) => {
  const existing = queryOne("SELECT id FROM contacts WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Contact not found" });

  db.run("DELETE FROM contacts WHERE id = ?", [req.params.id]);
  persist();

  res.status(204).send();
});

// ─── POST /contacts/import ────────────────────────────────────────────────────
contactsRouter.post("/import", (req: Request, res: Response) => {
  const result = z.array(CreateContactSchema).safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  for (const c of result.data) {
    const existing = queryOne("SELECT id FROM contacts WHERE email = ?", [c.email]);
    if (existing) {
      // Update existing
      db.run(
        `UPDATE contacts
         SET first_name = ?, last_name = ?, tags = ?, subscribed = ?, updated_at = datetime('now')
         WHERE email = ?`,
        [c.firstName, c.lastName, JSON.stringify(c.tags), c.subscribed ? 1 : 0, c.email]
      );
    } else {
      // Insert new
      db.run(
        "INSERT INTO contacts (id, email, first_name, last_name, tags, subscribed) VALUES (?, ?, ?, ?, ?, ?)",
        [randomUUID(), c.email, c.firstName, c.lastName, JSON.stringify(c.tags), c.subscribed ? 1 : 0]
      );
    }
  }
  persist();

  res.json({ message: `Successfully imported ${result.data.length} contacts` });
});
