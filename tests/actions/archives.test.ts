import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  prismaMock,
  sessionMock,
  revalidatePathMock,
  resetMocks,
  authedAs,
  unauthed,
} from "../helpers/action-mocks"

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/session", () => ({ getCurrentUser: sessionMock.getCurrentUser }))

import { archiveCurrentPeriod, deleteArchive } from "@/app/actions/archives"

beforeEach(() => {
  resetMocks()
})

describe("archiveCurrentPeriod", () => {
  it("creates an Archive and reassigns active expenses to it", async () => {
    authedAs()
    // The action calls $transaction with a callback that uses tx like prisma.
    // Forward the callback to prismaMock so we can assert on the inner calls.
    prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))
    prismaMock.expense.count.mockResolvedValue(3)
    prismaMock.archive.create.mockResolvedValue({ id: "arch-1" })
    prismaMock.expense.updateMany.mockResolvedValue({ count: 3 })

    const result = await archiveCurrentPeriod("Mai 2026")

    expect(result).toEqual({ success: true, archiveId: "arch-1" })
    expect(prismaMock.expense.count).toHaveBeenCalledWith({
      where: { coupleId: "couple-1", archiveId: null },
    })
    expect(prismaMock.archive.create).toHaveBeenCalledWith({
      data: { coupleId: "couple-1", label: "Mai 2026" },
    })
    expect(prismaMock.expense.updateMany).toHaveBeenCalledWith({
      where: { coupleId: "couple-1", archiveId: null },
      data: { archiveId: "arch-1" },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
    expect(revalidatePathMock).toHaveBeenCalledWith("/archives")
  })

  it("trims and validates the label", async () => {
    authedAs()
    prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))
    prismaMock.expense.count.mockResolvedValue(1)
    prismaMock.archive.create.mockResolvedValue({ id: "arch-1" })
    prismaMock.expense.updateMany.mockResolvedValue({ count: 1 })

    await archiveCurrentPeriod("  Mai 2026  ")

    expect(prismaMock.archive.create).toHaveBeenCalledWith({
      data: { coupleId: "couple-1", label: "Mai 2026" },
    })
  })

  it("rejects an empty label", async () => {
    authedAs()
    const result = await archiveCurrentPeriod("   ")
    expect(result).toEqual({ error: "Le nom de l'archive est requis" })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("rejects a label longer than 100 chars", async () => {
    authedAs()
    const result = await archiveCurrentPeriod("x".repeat(101))
    expect(result).toEqual({ error: "Le nom est trop long" })
  })

  it("returns an error when there are no active expenses", async () => {
    authedAs()
    prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))
    prismaMock.expense.count.mockResolvedValue(0)

    const result = await archiveCurrentPeriod("Mai 2026")

    expect(result).toEqual({ error: "Aucune dépense à archiver" })
    expect(prismaMock.archive.create).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await archiveCurrentPeriod("Mai 2026")
    expect(result).toEqual({ error: "Non authentifié" })
  })

  it("rejects users without a couple", async () => {
    authedAs({ coupleId: null })
    const result = await archiveCurrentPeriod("Mai 2026")
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("deleteArchive", () => {
  it("deletes an archive and its expenses inside a transaction", async () => {
    authedAs()
    prismaMock.archive.findFirst.mockResolvedValue({ id: "arch-1" })
    prismaMock.expense.deleteMany.mockReturnValue("deleteMany-call" as never)
    prismaMock.archive.delete.mockReturnValue("delete-call" as never)
    prismaMock.$transaction.mockResolvedValue([{ count: 5 }, {}])

    const result = await deleteArchive("arch-1")

    expect(result).toEqual({ success: true })
    expect(prismaMock.archive.findFirst).toHaveBeenCalledWith({
      where: { id: "arch-1", coupleId: "couple-1" },
    })
    expect(prismaMock.expense.deleteMany).toHaveBeenCalledWith({
      where: { archiveId: "arch-1", coupleId: "couple-1" },
    })
    expect(prismaMock.archive.delete).toHaveBeenCalledWith({
      where: { id: "arch-1" },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledWith(["deleteMany-call", "delete-call"])
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
    expect(revalidatePathMock).toHaveBeenCalledWith("/archives")
  })

  it("refuses to delete an archive owned by another couple", async () => {
    authedAs()
    prismaMock.archive.findFirst.mockResolvedValue(null)

    const result = await deleteArchive("arch-1")

    expect(result).toEqual({ error: "Archive introuvable" })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await deleteArchive("arch-1")
    expect(result).toEqual({ error: "Non authentifié" })
  })

  it("rejects users without a couple", async () => {
    authedAs({ coupleId: null })
    const result = await deleteArchive("arch-1")
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.archive.findFirst).not.toHaveBeenCalled()
  })
})
