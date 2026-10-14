export interface NotificationProvider {
  sendSms(to: string, message: string): Promise<void>;
}
