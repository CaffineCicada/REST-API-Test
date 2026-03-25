import cron from "node-cron";
import { query } from "../db/helpers";
import { dispatchCampaign } from "./dispatch";

let cronRunning = false;
let lastTickAt: Date | null = null;

export function startCronScheduler(): void {
  // Runs every 60 seconds
  cron.schedule("* * * * *", async () => {
    lastTickAt = new Date();
    console.log("[cron] Checking for scheduled campaigns...");

    const dueCampaigns = query(
      `SELECT id, name FROM campaigns
       WHERE status = 'scheduled'
         AND scheduled_at <= datetime('now')`
    );

    if (dueCampaigns.length === 0) {
      console.log("[cron] No campaigns due.");
      return;
    }

    console.log(`[cron] Found ${dueCampaigns.length} campaign(s) to send.`);

    // Dispatch in parallel (fire-and-forget; each dispatch serialises internally)
    for (const campaign of dueCampaigns) {
      dispatchCampaign(campaign.id).catch((err) => {
        console.error(`[cron] Error dispatching campaign ${campaign.id}:`, err);
      });
    }
  });

  cronRunning = true;
  console.log("[cron] Scheduler started – checking every 60 seconds");
}

export function getCronStatus() {
  return { running: cronRunning, lastTickAt: lastTickAt?.toISOString() ?? null };
}
