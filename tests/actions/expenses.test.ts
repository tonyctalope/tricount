import { describe, it, expect, beforeEach, vi } from "vitest"
import { Decimal } from "@prisma/client/runtime/library"
import {
  prismaMock,
  sessionMock,
  revalidatePathMock,
  resetMocks,
  authedAs,
  unauthed,
  makeFormData,
} from "../helpers/action-mocks"

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/session", () => ({ getCurrentUser: sessionMock.getCurrentUser }))

import {
  createExpense,
  updateExpense,
  deleteExpense,
  updateProrataPct,
} from "@/app/actions/expenses"

beforeEach(() => {
  resetMocks()
})

describe("createExpense", () => {
  const validForm = () =>
    makeFormData({
      description: "Courses",
      amount: "42.50",
      date: "2026-05-01",
      currency: "EUR",
      payerId: "user-1",
      participants: "BOTH",
      prorata: "false",
    })

  it("creates an expense scoped to the user's couple", async () => {
    authedAs()
    prismaMock.expense.create.mockResolvedValue({})

    const result = await createExpense(validForm())

    expect(result).toEqual({ success: true })
    expect(prismaMock.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coupleId: "couple-1",
        description: "Courses",
        currency: "EUR",
        payerId: "user-1",
        participants: "BOTH",
        prorata: false,
      }),
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
  })

  it("converts the amount string to a Decimal with the right value", async () => {
    authedAs()
    prismaMock.expense.create.mockResolvedValue({})

    await createExpense(validForm())

    const arg = prismaMock.expense.create.mock.calls[0][0]
    expect(arg.data.amount).toBeInstanceOf(Decimal)
    expect((arg.data.amount as Decimal).toString()).toBe("42.5")
  })

  it("parses prorata=true correctly", async () => {
    authedAs()
    prismaMock.expense.create.mockResolvedValue({})

    const fd = validForm()
    fd.set("prorata", "true")
    await createExpense(fd)

    expect(prismaMock.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ prorata: true }),
    })
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await createExpense(validForm())
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
  })

  it("rejects users without a couple", async () => {
    authedAs({ coupleId: null })
    const result = await createExpense(validForm())
    expect(result).toEqual({ error: "Non authentifié" })
  })

  it("rejects empty description", async () => {
    authedAs()
    const fd = validForm()
    fd.set("description", "")
    const result = await createExpense(fd)
    expect(result).toHaveProperty("error")
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
  })

  it("rejects non-positive amounts", async () => {
    authedAs()
    const fd = validForm()
    fd.set("amount", "0")
    const result = await createExpense(fd)
    expect(result).toHaveProperty("error")
    expect(prismaMock.expense.create).not.toHaveBeenCalled()
  })

  it("rejects invalid participants enum value", async () => {
    authedAs()
    const fd = validForm()
    fd.set("participants", "EVERYBODY")
    const result = await createExpense(fd)
    expect(result).toHaveProperty("error")
  })

  it("returns generic error when prisma throws", async () => {
    authedAs()
    prismaMock.expense.create.mockRejectedValue(new Error("db down"))
    const result = await createExpense(validForm())
    expect(result).toEqual({ error: "Une erreur est survenue" })
  })
})

describe("updateExpense", () => {
  const validForm = () =>
    makeFormData({
      description: "Courses (updated)",
      amount: "30",
      date: "2026-05-02",
      currency: "EUR",
      payerId: "user-1",
      participants: "BOTH",
      prorata: "false",
    })

  it("updates an active expense", async () => {
    authedAs()
    prismaMock.expense.findFirst.mockResolvedValue({ id: "exp-1" })
    prismaMock.expense.update.mockResolvedValue({})

    const result = await updateExpense("exp-1", validForm())

    expect(result).toEqual({ success: true })
    expect(prismaMock.expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp-1", coupleId: "couple-1", archiveId: null },
    })
    expect(prismaMock.expense.update).toHaveBeenCalledWith({
      where: { id: "exp-1" },
      data: expect.objectContaining({ description: "Courses (updated)" }),
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
    expect(revalidatePathMock).toHaveBeenCalledWith("/expenses/exp-1/edit")
  })

  it("refuses to update an archived/missing expense", async () => {
    authedAs()
    prismaMock.expense.findFirst.mockResolvedValue(null)

    const result = await updateExpense("exp-1", validForm())

    expect(result).toEqual({ error: "Dépense introuvable ou archivée" })
    expect(prismaMock.expense.update).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await updateExpense("exp-1", validForm())
    expect(result).toEqual({ error: "Non authentifié" })
  })
})

describe("deleteExpense", () => {
  it("deletes an active expense", async () => {
    authedAs()
    prismaMock.expense.findFirst.mockResolvedValue({ id: "exp-1" })
    prismaMock.expense.delete.mockResolvedValue({})

    const result = await deleteExpense("exp-1")

    expect(result).toEqual({ success: true })
    expect(prismaMock.expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp-1", coupleId: "couple-1", archiveId: null },
    })
    expect(prismaMock.expense.delete).toHaveBeenCalledWith({
      where: { id: "exp-1" },
    })
  })

  it("refuses to delete archived/missing expense", async () => {
    authedAs()
    prismaMock.expense.findFirst.mockResolvedValue(null)
    const result = await deleteExpense("exp-1")
    expect(result).toEqual({ error: "Dépense introuvable ou archivée" })
    expect(prismaMock.expense.delete).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await deleteExpense("exp-1")
    expect(result).toEqual({ error: "Non authentifié" })
  })
})

describe("updateProrataPct", () => {
  it("updates the percentage for the current user", async () => {
    authedAs()
    prismaMock.user.update.mockResolvedValue({})
    const result = await updateProrataPct(60)
    expect(result).toEqual({ success: true })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { prorataPct: 60 },
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings")
  })

  it.each([0, 50, 100])("accepts boundary value %i", async (pct) => {
    authedAs()
    prismaMock.user.update.mockResolvedValue({})
    const result = await updateProrataPct(pct)
    expect(result).toEqual({ success: true })
  })

  it.each([-1, 101, 150])("rejects out-of-range value %i", async (pct) => {
    authedAs()
    const result = await updateProrataPct(pct)
    expect(result).toEqual({ error: "Le pourcentage doit être entre 0 et 100" })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await updateProrataPct(50)
    expect(result).toEqual({ error: "Non authentifié" })
  })
})
