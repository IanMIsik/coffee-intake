import { CoffeeApiClient } from "@coffee/shared";
import { getApiUrl } from "./config";
import { getCachedToken, notifySessionExpired } from "./authStore";

export const api = new CoffeeApiClient({
  baseUrl: getApiUrl,
  getToken: getCachedToken,
  onUnauthorized: notifySessionExpired,
});
