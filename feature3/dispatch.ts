import { Resend } from "resend";
import { db, persist } from "../db";
import { query, queryOne } from "../db/helpers";
import { randomUUID } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

// ─── Variable interpolation (matches feature2 templates) ─────────────────────
function interpolate(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match;
  });
}

// ─── Send one email with exponential backoff on rate-limit (429) ─────────────
async function sendWithRetry(
  to: string,
  subject: string,
  html: string,
  retries = 3
): Promise<{ id?: string; error?: string }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
      if (result.error) {
        // Resend rate-limit comes back as a non-thrown error object
        const isRateLimit =
          (result.error as any).statusCode === 429 ||
          (result.error as any).name === "rate_limit_exceeded";
        if (isRateLimit && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`[campaigns] Rate limited – retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { error: (result.error as any).message ?? JSON.stringify(result.error) };
      }
      return { id: result.data?.id };
    } catch (err: any) {
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      return { error: err?.message ?? String(err) };
    }
  }
  return { error: "Max retries exceeded" };
}

// ─── Core dispatch: send a campaign to all matching contacts ──────────────────
export async function dispatchCampaign(campaignId: string): Promise<void> {
  const campaign = queryOne("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
  if (!campaign) {
    console.error(`[campaigns] Campaign ${campaignId} not found`);
    return;
  }

  if (campaign.status === "sending" || campaign.status === "sent") {
    console.log(`[campaigns] Campaign ${campaignId} already ${campaign.status}, skipping`);
    return;
  }

  const template = queryOne("SELECT * FROM templates WHERE id = ?", [campaign.template_id]);
  if (!template) {
    db.run("UPDATE campaigns SET status='failed' WHERE id=?", [campaignId]);
    persist();
    console.error(`[campaigns] Template ${campaign.template_id} not found for campaign ${campaignId}`);
    return;
  }

  // Mark as sending
  db.run("UPDATE campaigns SET status='sending' WHERE id=?", [campaignId]);
  persist();

  // Resolve target contacts
  const targetTags: string[] = JSON.parse(campaign.target_tags);
  let contacts: any[];

  if (targetTags.length === 0) {
    // No tag filter – send to all subscribed contacts
    contacts = query("SELECT * FROM contacts WHERE subscribed = 1");
  } else {
    // Filter contacts that have ANY of the target tags
    const allContacts = query("SELECT * FROM contacts WHERE subscribed = 1");
    contacts = allContacts.filter((c) => {
      const contactTags: string[] = JSON.parse(c.tags);
      return targetTags.some((t) => contactTags.includes(t));
    });
  }

  console.log(`[campaigns] Dispatching "${campaign.name}" to ${contacts.length} recipients`);

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    const personData: Record<string, string> = {
      first_name: contact.first_name,
      last_name:  contact.last_name,
      email:      contact.email,
    };

    const subject = interpolate(template.subject, personData);
    const html    = interpolate(template.html_body, personData);

    const result = await sendWithRetry(contact.email, subject, html);

    const logId = randomUUID();
    if (result.id) {
      db.run(
        "INSERT INTO send_logs (id, campaign_id, contact_id, status, resend_message_id) VALUES (?, ?, ?, 'sent', ?)",
        [logId, campaignId, contact.id, result.id]
      );
      sentCount++;
    } else {
      db.run(
        "INSERT INTO send_logs (id, campaign_id, contact_id, status, error_message) VALUES (?, ?, ?, 'failed', ?)",
        [logId, campaignId, contact.id, result.error ?? "Unknown error"]
      );
      failedCount++;
    }

    // Respect Resend free-tier 1 email/second limit
    await new Promise((r) => setTimeout(r, 1100));
  }

  const finalStatus = failedCount === contacts.length && contacts.length > 0 ? "failed" : "sent";
  db.run(
    "UPDATE campaigns SET status=?, sent_count=?, failed_count=? WHERE id=?",
    [finalStatus, sentCount, failedCount, campaignId]
  );
  persist();

  console.log(
    `[campaigns] Campaign "${campaign.name}" complete – sent: ${sentCount}, failed: ${failedCount}`
  );
}
