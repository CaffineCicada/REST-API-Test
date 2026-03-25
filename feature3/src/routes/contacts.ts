import { Router, Request, Response } from "express";
import { db, persist } from "../db";
import { query, queryOne } from "../db/helpers";
import { z } from "zod";
import { randomUUID } from "crypto";

export const contactsRouter = Router();

const CreateContactSchema = z.object({
  email:      z.string().email("Must be a valid email address"),
  firstName:  z.string().min(1, "firstName is required"),
  lastName:   z.string().min(1, "lastName is required"),
  tags:       z.array(z.string()).default([]),
  subscribed: z.boolean().default(true),
});

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

contactsRouter.get("/", (_req, res) => {
  res.json({ data: query("SELECT * FROM contacts ORDER BY created_at DESC").map(rowToContact) });
});

contactsRouter.get("/:id", (req, res) => {
  const row = queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Contact not found" });
  res.json({ data: rowToContact(row) });
});

contactsRouter.post("/", (req: Request, res: Response) => {
  const result = CreateContactSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });

  const { email, firstName, lastName, tags, subscribed } = result.data;
  if (queryOne("SELECT id FROM contacts WHERE email = ?", [email])) {
    return res.status(409).json({ error: "A contact with this email already exists" });
  }

  const id = randomUUID();
  db.run("INSERT INTO contacts (id, email, first_name, last_name, tags, subscribed) VALUES (?, ?, ?, ?, ?, ?)",
    [id, email, firstName, lastName, JSON.stringify(tags), subscribed ? 1 : 0]);
  persist();

  res.status(201).json({ data: rowToContact(queryOne("SELECT * FROM contacts WHERE id = ?", [id])) });
});

contactsRouter.put("/:id", (req: Request, res: Response) => {
  const existing = queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Contact not found" });

  const result = CreateContactSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });

  const u = result.data;
  db.run(
    `UPDATE contacts SET email=?, first_name=?, last_name=?, tags=?, subscribed=?, updated_at=datetime('now') WHERE id=?`,
    [u.email ?? existing.email, u.firstName ?? existing.first_name, u.lastName ?? existing.last_name,
     u.tags !== undefined ? JSON.stringify(u.tags) : existing.tags,
     u.subscribed !== undefined ? (u.subscribed ? 1 : 0) : existing.subscribed, req.params.id]);
  persist();

  res.json({ data: rowToContact(queryOne("SELECT * FROM contacts WHERE id = ?", [req.params.id])) });
});

contactsRouter.delete("/:id", (req: Request, res: Response) => {
  if (!queryOne("SELECT id FROM contacts WHERE id = ?", [req.params.id])) {
    return res.status(404).json({ error: "Contact not found" });
  }
  db.run("DELETE FROM contacts WHERE id = ?", [req.params.id]);
  persist();
  res.status(204).send();
});

contactsRouter.post("/import", (req: Request, res: Response) => {
  const result = z.array(CreateContactSchema).safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });

  for (const c of result.data) {
    if (queryOne("SELECT id FROM contacts WHERE email = ?", [c.email])) {
      db.run(`UPDATE contacts SET first_name=?, last_name=?, tags=?, subscribed=?, updated_at=datetime('now') WHERE email=?`,
        [c.firstName, c.lastName, JSON.stringify(c.tags), c.subscribed ? 1 : 0, c.email]);
    } else {
      db.run("INSERT INTO contacts (id, email, first_name, last_name, tags, subscribed) VALUES (?, ?, ?, ?, ?, ?)",
        [randomUUID(), c.email, c.firstName, c.lastName, JSON.stringify(c.tags), c.subscribed ? 1 : 0]);
    }
  }
  persist();
  res.json({ message: `Successfully imported ${result.data.length} contacts` });
});
