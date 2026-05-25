import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("joins simple class names", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("filters falsy values (clsx behaviour)", () => {
    // oxlint-disable-next-line no-constant-binary-expression
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c")
  })

  it("handles conditional objects", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b")
  })

  it("merges conflicting Tailwind utilities — last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("text-sm text-lg")).toBe("text-lg")
  })

  it("preserves non-conflicting utilities", () => {
    expect(cn("text-red-500", "font-bold")).toBe("text-red-500 font-bold")
  })

  it("returns an empty string when given nothing meaningful", () => {
    expect(cn(null, undefined, false)).toBe("")
  })
})
