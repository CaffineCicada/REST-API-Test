import { Router, Request, Response } from "express";
import { db, persist } from "../db";
import { query, queryOne } from "../db/helpers";
import { dispatchCampaign } from "../campaigns/dispatch";
import { z } from "zod";
import { randomUUID } from "crypto";

export const campaignsRouter = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────
const CreateCampaignSchema = z.object({
  name:       z.string().min(1, "name is required"),
  templateId: z.string().uuid("templateId must be a valid UUID"),
  targetTags: z.array(z.string()).default([]),
});

const ScheduleSchema = z.object({
  scheduledAt: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "scheduledAt must be a valid ISO 8601 datetime string",
  }),
});

// ─── Helper: convert raw row ──────────────────────────────────────────────────
function rowToCampaign(row: any) {
  return {
    id:          row.id,
    name:        row.name,
    templateId:  row.template_id,
    targetTags:  JSON.parse(row.target_tags),
    scheduledAt: row.scheduled_at ?? null,
    status:      row.status,
    sentCount:   row.sent_count,
    failedCount: row.failed_count,
    createdAt:   row.created_at,
  };
}

// ─── GET /campaigns ───────────────────────────────────────────────────────────
campaignsRouter.get("/", (_req: Request, res: Response) => {
  const rows = query("SELECT * FROM campaigns ORDER BY created_at DESC");
  res.json({ data: rows.map(rowToCampaign) });
});

// ─── POST /campaigns ──────────────────────────────────────────────────────────
campaignsRouter.post("/", (req: Request, res: Response) => {
  const result = CreateCampaignSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.flatten().fieldErrors,
    });
  }

  const { name, templateId, targetTags } = result.data;

  // Validate the referenced template exists
  if (!queryOne("SELECT id FROM templates WHERE id = ?", [templateId])) {
    return res.status(404).json({ error: "Template not found" });
  }

  const id = randomUUID();
  db.run(
    "INSERT INTO campaigns (id, name, template_id, target_tags) VALUES (?, ?, ?, ?)",
    [id, name, templateId, JSON.stringify(targetTags)]
  );
  persist();

  const created = queryOne("SELECT * FROM campaigns WHERE id = ?", [id]);
  res.status(201).json({ data: rowToCampaign(created) });
});

// ─── PATCH /campaigns/:id/schedule ───────────────────────────────────────────
campaignsRouter.patch("/:id/schedule", (req: Request, res: Response) => {
  const campaign = queryOne("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (campaign.status === "sending" || campaign.status === "sent") {
    return res.status(409).json({
      error: `Cannot reschedule a campaign with status '${campaign.status}'`,
    });
  }

  const result = ScheduleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.flatten().fieldErrors,
    });
  }

  const { scheduledAt } = result.data;

  // Store as ISO string; SQLite comparison works via lexicographic order on ISO dates
  db.run(
    "UPDATE campaigns SET scheduled_at=?, status='scheduled' WHERE id=?",
    [new Date(scheduledAt).toISOString().replace("T", " ").split(".")[0], req.params.id]
  );
  persist();

  const updated = queryOne("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
  res.json({ data: rowToCampaign(updated) });
});

// ─── POST /campaigns/:id/send-now ─────────────────────────────────────────────
campaignsRouter.post("/:id/send-now", async (req: Request, res: Response) => {
  const campaign = queryOne("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  if (campaign.status === "sending") {
    return res.status(409).json({ error: "Campaign is already sending" });
  }
  if (campaign.status === "sent") {
    return res.status(409).json({ error: "Campaign has already been sent" });
  }

  // Acknowledge immediately; dispatch runs in the background
  res.status(202).json({
    message: "Campaign send initiated",
    campaignId: campaign.id,
  });

  dispatchCampaign(campaign.id).catch((err) => {
    console.error(`[campaigns] send-now error for ${campaign.id}:`, err);
  });
});

// ─── GET /campaigns/:id/status ────────────────────────────────────────────────
campaignsRouter.get("/:id/status", (req: Request, res: Response) => {
  const campaign = queryOne("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const logs = query(
    "SELECT status, COUNT(*) as count FROM send_logs WHERE campaign_id = ? GROUP BY status",
    [req.params.id]
  );

  const logSummary: Record<string, number> = {};
  for (const row of logs) {
    logSummary[row.status] = Number(row.count);
  }

  res.json({
    data: {
      ...rowToCampaign(campaign),
      logSummary,
    },
  });
});
