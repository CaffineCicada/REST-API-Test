import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { triggerCampaignSend } from "../services/scheduler";

const campaignsRouter = Router();

/**
 * POST /campaigns
 * Create campaign
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, template_id, target_tags } = req.body;

    if (!name || !template_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        template_id,
        target_tags,
        status: "draft",
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

/**
 * PATCH /campaigns/:id/schedule
 */
router.patch("/:id/schedule", async (req: Request, res: Response) => {
  try {
    const { scheduled_at } = req.body;
    const { id } = req.params;

    if (!scheduled_at) {
      return res.status(400).json({ error: "scheduled_at required" });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        scheduled_at: new Date(scheduled_at),
        status: "scheduled",
      },
    });

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: "Failed to schedule campaign" });
  }
});

/**
 * POST /campaigns/:id/send-now
 */
router.post("/:id/send-now", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "sending" },
    });

    // trigger async send
    triggerCampaignSend(campaign.id);

    res.json({ message: "Campaign sending started" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send campaign" });
  }
});

/**
 * GET /campaigns/:id/status
 */
router.get("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json({
      status: campaign.status,
      sent_count: campaign.sent_count,
      failed_count: campaign.failed_count,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

export default router;