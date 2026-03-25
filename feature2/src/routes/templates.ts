import { Router, Request, Response } from "express";
import { db, persist } from "../db";
import { query, queryOne } from "../db/helpers";
import { z } from "zod";
import { randomUUID } from "crypto";

export const templatesRouter = Router();

// ─── Validation ───────────────────────────────────────────────────────────────
const CreateTemplateSchema = z.object({
  name:      z.string().min(1, "name is required"),
  subject:   z.string().min(1, "subject is required"),
  htmlBody:  z.string().min(1, "htmlBody is required"),
  variables: z.array(z.string()).default([]),
});

const UpdateTemplateSchema = CreateTemplateSchema.partial();

// ─── Helper: convert raw DB row to clean object ───────────────────────────────
function rowToTemplate(row: any) {
  return {
    id:        row.id,
    name:      row.name,
    subject:   row.subject,
    htmlBody:  row.html_body,
    variables: JSON.parse(row.variables),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Helper: replace {{variable}} placeholders with real values ───────────────
function interpolate(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match;
  });
}

// ─── GET /templates ───────────────────────────────────────────────────────────
templatesRouter.get("/", (_req: Request, res: Response) => {
  const rows = query("SELECT * FROM templates ORDER BY created_at DESC");
  res.json({ data: rows.map(rowToTemplate) });
});

// ─── GET /templates/:id ───────────────────────────────────────────────────────
templatesRouter.get("/:id", (req: Request, res: Response) => {
  const row = queryOne("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Template not found" });
  res.json({ data: rowToTemplate(row) });
});

// ─── POST /templates ──────────────────────────────────────────────────────────
templatesRouter.post("/", (req: Request, res: Response) => {
  const result = CreateTemplateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
  }

  const { name, subject, htmlBody, variables } = result.data;
  const id = randomUUID();

  db.run(
    "INSERT INTO templates (id, name, subject, html_body, variables) VALUES (?, ?, ?, ?, ?)",
    [id, name, subject, htmlBody, JSON.stringify(variables)]
  );
  persist();

  const created = queryOne("SELECT * FROM templates WHERE id = ?", [id]);
  res.status(201).json({ data: rowToTemplate(created) });
});

// ─── PUT /templates/:id ───────────────────────────────────────────────────────
templatesRouter.put("/:id", (req: Request, res: Response) => {
  const existing = queryOne("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const result = UpdateTemplateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten().fieldErrors });
  }

  const u = result.data;
  const newName      = u.name      ?? existing.name;
  const newSubject   = u.subject   ?? existing.subject;
  const newHtmlBody  = u.htmlBody  ?? existing.html_body;
  const newVariables = u.variables !== undefined ? JSON.stringify(u.variables) : existing.variables;

  db.run(
    `UPDATE templates SET name=?, subject=?, html_body=?, variables=?, updated_at=datetime('now') WHERE id=?`,
    [newName, newSubject, newHtmlBody, newVariables, req.params.id]
  );
  persist();

  const updated = queryOne("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  res.json({ data: rowToTemplate(updated) });
});

// ─── DELETE /templates/:id ────────────────────────────────────────────────────
templatesRouter.delete("/:id", (req: Request, res: Response) => {
  if (!queryOne("SELECT id FROM templates WHERE id = ?", [req.params.id])) {
    return res.status(404).json({ error: "Template not found" });
  }

  db.run("DELETE FROM templates WHERE id = ?", [req.params.id]);
  persist();
  res.status(204).send();
});

// ─── POST /templates/:id/preview ─────────────────────────────────────────────
// Accepts sample data and returns the rendered subject + HTML
templatesRouter.post("/:id/preview", (req: Request, res: Response) => {
  const row = queryOne("SELECT * FROM templates WHERE id = ?", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Template not found" });

  // req.body should be a flat object like { "first_name": "Alice", "company": "Acme" }
  const sampleData = req.body as Record<string, string>;

  const renderedSubject = interpolate(row.subject, sampleData);
  const renderedHtml    = interpolate(row.html_body, sampleData);

  // Also report which variables were found vs still unresolved
  const variables: string[] = JSON.parse(row.variables);
  const resolved   = variables.filter((v) => v in sampleData);
  const unresolved = variables.filter((v) => !(v in sampleData));

  res.json({
    data: {
      subject:    renderedSubject,
      html:       renderedHtml,
      resolved,
      unresolved,
    },
  });
});
