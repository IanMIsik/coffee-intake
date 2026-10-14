import { describe, expect, it } from "vitest";
import { normalizePhone, phoneSchema } from "@coffee/shared";
import { addDays, isDateString, startOfDayIn, todayIn } from "../src/lib/dates";
import { safeEqual } from "../src/lib/safeEqual";

describe("normalizePhone", () => {
  it.each([
    ["+254712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["0712345678", "+254712345678"],
    ["0712 345 678", "+254712345678"],
    ["+254 712-345-678", "+254712345678"],
    ["00254712345678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["+256700123456", "+256700123456"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("rejects things that aren't phone numbers", () => {
    expect(phoneSchema.safeParse("abc").success).toBe(false);
    expect(phoneSchema.safeParse("123").success).toBe(false);
    expect(phoneSchema.safeParse("0712345678").success).toBe(true);
  });
});

describe("date helpers", () => {
  it("finds the start of a Nairobi day (UTC+3)", () => {
    expect(startOfDayIn("2026-10-15", "Africa/Nairobi").toISOString()).toBe("2026-10-14T21:00:00.000Z");
    expect(startOfDayIn("2026-10-15", "UTC").toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("knows today's date in a time zone, not just in UTC", () => {
    const lateUtc = new Date("2026-10-14T22:30:00Z");
    expect(todayIn("UTC", lateUtc)).toBe("2026-10-14");
    expect(todayIn("Africa/Nairobi", lateUtc)).toBe("2026-10-15");
  });

  it("does date arithmetic and validation", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isDateString("2026-10-14")).toBe(true);
    expect(isDateString("2026-13-45")).toBe(false);
    expect(isDateString("tomorrow")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares secrets without leaking length or position", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secreT", "secret")).toBe(false);
    expect(safeEqual("short", "a-much-longer-secret")).toBe(false);
    expect(safeEqual(undefined, "secret")).toBe(false);
  });
});

describe("legacy photo references", () => {
  it("recovers the storage key from a public URL saved before photos became private", async () => {
    const { extractPhotoKey } = await import("../src/lib/photos");
    expect(extractPhotoKey("http://localhost:4000/uploads/org-1/receipts/abc.jpg")).toBe("org-1/receipts/abc.jpg");
    expect(extractPhotoKey("http://192.168.0.5:4000/uploads/org-1/receipts/abc-name%20x.jpg")).toBe("org-1/receipts/abc-name x.jpg");
    expect(extractPhotoKey("org-1/receipts/abc.png")).toBe("org-1/receipts/abc.png");
    expect(extractPhotoKey("https://elsewhere.example.com/photo.jpg")).toBeNull();
  });
});
