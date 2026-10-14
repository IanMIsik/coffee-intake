import { CoffeeApiClient } from "@coffee/shared";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const ORGANIZATION_SLUG = import.meta.env.VITE_ORGANIZATION_SLUG ?? "demo-factory";

export const TOKEN_STORAGE_KEY = "coffee.auth.token";
const SESSION_STORAGE_KEY = "coffee.auth.session";

export const api = new CoffeeApiClient({
  baseUrl,
  getToken: () => localStorage.getItem(TOKEN_STORAGE_KEY),
  // The token expired, or the account was deleted: clear the session and go to login.
  onUnauthorized: () => {
    const wasFarmer = location.pathname.startsWith("/me");
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    location.href = wasFarmer ? "/me/login" : "/login";
  },
});
