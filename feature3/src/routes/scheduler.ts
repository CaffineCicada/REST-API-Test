import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * Start cron scheduler
 */
export const startScheduler = () => {
  cron.schedule("* * * * *", async () => {
    console.log("Checking scheduled campaigns...");

    const now = new Date();

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "scheduled",
        scheduled_at: { lte: now },
      },
    });

    for (const campaign of campaigns) {
      triggerCampaignSend(campaign.id);
    }
  });
};

/**
 * Trigger sending campaign
 */
export const triggerCampaignSend = async (campaignId: string) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { template: true },
    });

    if (!campaign) return;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "sending" },
    });

    // get contacts matching tags
    const contacts = await prisma.contact.findMany({
      where: {
        subscribed: true,
        tags: {
          hasSome: campaign.target_tags || [],
        },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        const html = interpolateTemplate(
          campaign.template.html_body,
          contact
        );

        const response = await resend.emails.send({
          from: "onboarding@resend.dev",
          to: contact.email,
          subject: campaign.template.subject,
          html,
        });

        await prisma.sendLog.create({
          data: {
            campaign_id: campaignId,
            contact_id: contact.id,
            status: "sent",
            resend_message_id: response.data?.id,
            sent_at: new Date(),
          },
        });

        sent++;

        // basic rate limit (1 email/sec)
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        failed++;

        await prisma.sendLog.create({
          data: {
            campaign_id: campaignId,
            contact_id: contact.id,
            status: "failed",
            error_message: err.message,
            sent_at: new Date(),
          },
        });
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "sent",
        sent_count: sent,
        failed_count: failed,
      },
    });
  } catch (err) {
    console.error("Campaign send failed:", err);

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    });
  }
};

/**
 * Simple {{variable}} interpolation
 */
const interpolateTemplate = (html: string, data: any) => {
  return html.replace(/{{(.*?)}}/g, (_, key) => {
    return data[key.trim()] || "";
  });
};