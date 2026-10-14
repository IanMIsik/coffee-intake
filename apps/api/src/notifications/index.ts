import { env } from "../env";
import { AfricasTalkingProvider } from "./AfricasTalkingProvider";
import { ConsoleLogProvider } from "./ConsoleLogProvider";
import type { NotificationProvider } from "./NotificationProvider";

export function createNotificationProvider(senderId?: string): NotificationProvider {
  if (env.africasTalking.username && env.africasTalking.apiKey) {
    return new AfricasTalkingProvider(
      env.africasTalking.username,
      env.africasTalking.apiKey,
      // Alphanumeric sender IDs must be registered with Africa's Talking first;
      // an unregistered one makes every send fail, so it's opt-in.
      env.africasTalking.useSenderId ? senderId : undefined
    );
  }
  return new ConsoleLogProvider();
}

export type { NotificationProvider };
