import type { NotificationProvider } from "./NotificationProvider";

const SANDBOX_HOST = "api.sandbox.africastalking.com";
const LIVE_HOST = "api.africastalking.com";

interface AtRecipient {
  number: string;
  status: string;
  statusCode: number;
}

interface AtResponse {
  SMSMessageData?: { Message?: string; Recipients?: AtRecipient[] };
}

/**
 * Talks to Africa's Talking's REST messaging endpoint directly (no SDK dependency).
 * Uses the sandbox host automatically when username is "sandbox", matching AT's own
 * convention. Africa's Talking answers HTTP 201 even when nothing was sent (e.g.
 * "InvalidSenderId" with an empty recipient list), so the body is checked too.
 */
export class AfricasTalkingProvider implements NotificationProvider {
  constructor(
    private username: string,
    private apiKey: string,
    private senderId?: string
  ) {}

  async sendSms(to: string, message: string): Promise<void> {
    const host = this.username === "sandbox" ? SANDBOX_HOST : LIVE_HOST;
    const body = new URLSearchParams({
      username: this.username,
      to,
      message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    const res = await fetch(`https://${host}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey: this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`Africa's Talking SMS send failed (${res.status}): ${text}`);
    }

    let data: AtResponse = {};
    try {
      data = JSON.parse(text) as AtResponse;
    } catch {
      throw new Error(`Africa's Talking returned an unreadable response: ${text}`);
    }

    const recipients = data.SMSMessageData?.Recipients ?? [];
    // "Success" here only means Africa's Talking accepted and charged the message; the
    // final delivery result appears later in their dashboard. The id lets you look it up.
    for (const r of recipients as (AtRecipient & { messageId?: string; cost?: string })[]) {
      console.log(
        `[SMS] ${new Date().toISOString()} to ${r.number} status=${r.status} (${r.statusCode}) cost=${r.cost} messageId=${r.messageId}`
      );
    }
    const failed = recipients.find((r) => r.status !== "Success");
    if (recipients.length === 0 || failed) {
      const reason = failed ? `${failed.status} (${failed.statusCode})` : data.SMSMessageData?.Message;
      throw new Error(`Africa's Talking did not send the SMS to ${to}: ${reason}`);
    }
  }
}
