import { describe, it, expect } from "vitest"
import { buildProrataSnapshot, parseProrataSnapshot } from "@/lib/prorata-snapshot"

describe("buildProrataSnapshot", () => {
  it("indexes the percentages by user id", () => {
    expect(
      buildProrataSnapshot([
        { id: "u1", prorataPct: 65 },
        { id: "u2", prorataPct: 35 },
      ]),
    ).toEqual({ u1: 65, u2: 35 })
  })

  it("returns an empty object for an empty couple", () => {
    expect(buildProrataSnapshot([])).toEqual({})
  })
})

describe("parseProrataSnapshot", () => {
  it("reads a stored snapshot", () => {
    expect(parseProrataSnapshot({ u1: 65, u2: 35 })).toEqual({ u1: 65, u2: 35 })
  })

  it("returns null for archives created before the freeze", () => {
    expect(parseProrataSnapshot(null)).toBeNull()
    expect(parseProrataSnapshot(undefined)).toBeNull()
  })

  it("returns null for a non-object payload", () => {
    expect(parseProrataSnapshot("65")).toBeNull()
    expect(parseProrataSnapshot(65)).toBeNull()
    expect(parseProrataSnapshot([65, 35])).toBeNull()
    expect(parseProrataSnapshot({})).toBeNull()
  })

  it("drops entries that are not finite numbers", () => {
    expect(parseProrataSnapshot({ u1: 65, u2: "35", u3: null })).toEqual({ u1: 65 })
  })
})
