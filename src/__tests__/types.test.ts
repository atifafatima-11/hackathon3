import { describe, it, expect } from "vitest";
import { formatTimeAgo, formatDate } from "../types";

describe("formatTimeAgo", () => {
  it("returns 'just now' for recent dates", () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe("just now");
  });

  it("returns minutes for dates within the last hour", () => {
    const date = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(date)).toBe("5m ago");
  });

  it("returns hours for dates within the last day", () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(date)).toBe("3h ago");
  });

  it("returns days for older dates", () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(date)).toBe("2d ago");
  });
});

describe("formatDate", () => {
  it("formats a date string into a readable format", () => {
    const result = formatDate("2026-09-27T14:30:00Z");
    expect(result).toContain("Sep");
    expect(result).toContain("27");
    expect(result).toContain("2026");
  });
});
