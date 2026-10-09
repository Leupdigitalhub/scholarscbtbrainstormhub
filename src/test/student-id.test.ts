import { describe, expect, it } from "vitest";
import { makeStudentId } from "@/lib/avatar";

describe("makeStudentId", () => {
  it("is SCHCBT followed by 4 digits", () => {
    for (let i = 0; i < 50; i++) expect(makeStudentId()).toMatch(/^SCHCBT\d{4}$/);
  });
  it("pads small numbers", () => {
    expect(makeStudentId(() => 0.0342)).toBe("SCHCBT0342");
  });
});
