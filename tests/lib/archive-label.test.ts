import { describe, it, expect } from "vitest"
import { getDefaultArchiveLabel } from "@/lib/archive-label"

describe("getDefaultArchiveLabel", () => {
  it("returns the previous month name in French, capitalised", () => {
    expect(getDefaultArchiveLabel(new Date(2026, 4, 15))).toBe("Avril 2026")
  })

  it("rolls over to December of the previous year on January", () => {
    expect(getDefaultArchiveLabel(new Date(2026, 0, 5))).toBe("Décembre 2025")
  })

  it("handles the first of the month", () => {
    expect(getDefaultArchiveLabel(new Date(2026, 5, 1))).toBe("Mai 2026")
  })

  it("handles the last day of the month", () => {
    expect(getDefaultArchiveLabel(new Date(2026, 11, 31))).toBe("Novembre 2026")
  })

  it("uses today's date when no argument is supplied", () => {
    const result = getDefaultArchiveLabel()
    // Format is "<Month> <Year>", capitalised
    expect(result).toMatch(/^[A-ZÀ-Ÿ][a-zà-ÿ]+ \d{4}$/)
  })
})
