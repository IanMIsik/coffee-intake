import type { NotificationProvider } from "./NotificationProvider";

/**
 * Fallback used in development when no Africa's Talking credentials are configured.
 * Prints the SMS to the server console instead of sending it, so OTP codes and
 * receipt confirmations are still visible while testing locally.
 */
export class ConsoleLogProvider implements NotificationProvider {
  async sendSms(to: string, message: string): Promise<void> {
    console.log(`[SMS -> ${to}] ${message}`);
  }
}
