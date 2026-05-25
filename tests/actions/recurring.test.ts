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
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  applyAllRecurringExpenses,
} from "@/app/actions/recurring"

beforeEach(() => {
  resetMocks()
})

describe("createRecurringExpense", () => {
  const validForm = () =>
    makeFormData({
      description: "Loyer",
      amount: "900",
      currency: "EUR",
      payerId: "user-1",
      participants: "BOTH",
      prorata: "true",
    })

  it("creates a recurring template", async () => {
    authedAs()
    prismaMock.recurringExpense.create.mockResolvedValue({})

    const result = await createRecurringExpense(validForm())

    expect(result).toEqual({ success: true })
    expect(prismaMock.recurringExpense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coupleId: "couple-1",
        description: "Loyer",
        prorata: true,
        participants: "BOTH",
      }),
    })
    expect(revalidatePathMock).toHaveBeenCalledWith("/recurring")
    expect(revalidatePathMock).toHaveBeenCalledWith("/")
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await createRecurringExpense(validForm())
    expect(result).toEqual({ error: "Non authentifié" })
  })

  it("rejects users without a couple", async () => {
    authedAs({ coupleId: null })
    const result = await createRecurringExpense(validForm())
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.recurringExpense.create).not.toHaveBeenCalled()
  })

  it("rejects invalid input", async () => {
    authedAs()
    const fd = validForm()
    fd.set("amount", "-10")
    const result = await createRecurringExpense(fd)
    expect(result).toHaveProperty("error")
    expect(prismaMock.recurringExpense.create).not.toHaveBeenCalled()
  })
})

describe("updateRecurringExpense", () => {
  const validForm = () =>
    makeFormData({
      description: "Loyer (updated)",
      amount: "950",
      currency: "EUR",
      payerId: "user-1",
      participants: "BOTH",
      prorata: "true",
    })

  it("updates an existing template owned by the couple", async () => {
    authedAs()
    prismaMock.recurringExpense.findFirst.mockResolvedValue({ id: "rec-1" })
    prismaMock.recurringExpense.update.mockResolvedValue({})

    const result = await updateRecurringExpense("rec-1", validForm())

    expect(result).toEqual({ success: true })
    expect(prismaMock.recurringExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "rec-1", coupleId: "couple-1" },
    })
  })

  it("refuses to update a template owned by another couple", async () => {
    authedAs()
    prismaMock.recurringExpense.findFirst.mockResolvedValue(null)

    const result = await updateRecurringExpense("rec-1", validForm())

    expect(result).toEqual({ error: "Dépense récurrente introuvable" })
    expect(prismaMock.recurringExpense.update).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await updateRecurringExpense("rec-1", validForm())
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.recurringExpense.findFirst).not.toHaveBeenCalled()
  })

  it("revalidates both the list and the edit page on success", async () => {
    authedAs()
    prismaMock.recurringExpense.findFirst.mockResolvedValue({ id: "rec-1" })
    prismaMock.recurringExpense.update.mockResolvedValue({})

    await updateRecurringExpense("rec-1", validForm())

    expect(revalidatePathMock).toHaveBeenCalledWith("/recurring")
    expect(revalidatePathMock).toHaveBeenCalledWith("/recurring/rec-1/edit")
  })
})

describe("deleteRecurringExpense", () => {
  it("deletes an existing template", async () => {
    authedAs()
    prismaMock.recurringExpense.findFirst.mockResolvedValue({ id: "rec-1" })
    prismaMock.recurringExpense.delete.mockResolvedValue({})

    const result = await deleteRecurringExpense("rec-1")
    expect(result).toEqual({ success: true })
  })

  it("refuses to delete a template owned by another couple", async () => {
    authedAs()
    prismaMock.recurringExpense.findFirst.mockResolvedValue(null)

    const result = await deleteRecurringExpense("rec-1")
    expect(result).toEqual({ error: "Dépense récurrente introuvable" })
    expect(prismaMock.recurringExpense.delete).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await deleteRecurringExpense("rec-1")
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.recurringExpense.findFirst).not.toHaveBeenCalled()
  })
})

describe("applyAllRecurringExpenses", () => {
  it("creates one expense per template using today's date", async () => {
    authedAs()
    const templates = [
      {
        id: "rec-1",
        coupleId: "couple-1",
        payerId: "user-1",
        description: "Loyer",
        amount: new Decimal(900),
        currency: "EUR",
        participants: "BOTH",
        prorata: true,
      },
      {
        id: "rec-2",
        coupleId: "couple-1",
        payerId: "user-2",
        description: "Internet",
        amount: new Decimal(40),
        currency: "EUR",
        participants: "BOTH",
        prorata: false,
      },
    ]
    prismaMock.recurringExpense.findMany.mockResolvedValue(templates)
    prismaMock.expense.createMany.mockResolvedValue({ count: 2 })

    const result = await applyAllRecurringExpenses()

    expect(result).toEqual({ success: true, count: 2 })
    expect(prismaMock.expense.createMany).toHaveBeenCalledTimes(1)
    const arg = prismaMock.expense.createMany.mock.calls[0][0]
    expect(arg.data).toHaveLength(2)
    expect(arg.data[0]).toMatchObject({
      coupleId: "couple-1",
      payerId: "user-1",
      description: "Loyer",
      participants: "BOTH",
      prorata: true,
    })
    expect(arg.data[1]).toMatchObject({
      coupleId: "couple-1",
      payerId: "user-2",
      description: "Internet",
      participants: "BOTH",
      prorata: false,
    })
    // Each created expense gets a date populated server-side
    expect(arg.data[0].date).toBeInstanceOf(Date)
    expect(arg.data[1].date).toBeInstanceOf(Date)
  })

  it("returns an error when there are no templates", async () => {
    authedAs()
    prismaMock.recurringExpense.findMany.mockResolvedValue([])
    const result = await applyAllRecurringExpenses()
    expect(result).toEqual({ error: "Aucune dépense récurrente à appliquer" })
    expect(prismaMock.expense.createMany).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated callers", async () => {
    unauthed()
    const result = await applyAllRecurringExpenses()
    expect(result).toEqual({ error: "Non authentifié" })
  })

  it("rejects users without a couple", async () => {
    authedAs({ coupleId: null })
    const result = await applyAllRecurringExpenses()
    expect(result).toEqual({ error: "Non authentifié" })
    expect(prismaMock.recurringExpense.findMany).not.toHaveBeenCalled()
  })
})
