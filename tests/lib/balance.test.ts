import { describe, it, expect } from "vitest"
import { Decimal } from "@prisma/client/runtime/library"
import { calculateBalances } from "@/lib/balance"
import { makeExpense, makeUser } from "../helpers/fixtures"

describe("calculateBalances", () => {
  const user1 = makeUser({ id: "u1", prorataPct: 65 })
  const user2 = makeUser({ id: "u2", prorataPct: 35 })

  describe("empty input", () => {
    it("returns zero balances when no expenses", () => {
      const { balance1, balance2 } = calculateBalances([], user1, user2)
      expect(balance1).toBe(0)
      expect(balance2).toBe(0)
    })
  })

  describe("non-prorata mode", () => {
    it("splits BOTH 50/50 — payer is owed half", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(100),
        participants: "BOTH",
        prorata: false,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(50)
      expect(balance2).toBe(-50)
    })

    it("PAYER_ONLY: payer covers their own share, no debt", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(80),
        participants: "PAYER_ONLY",
        prorata: false,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(0)
      expect(balance2).toBe(0)
    })

    it("OTHER_ONLY: payer is fully reimbursed by the other", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(40),
        participants: "OTHER_ONLY",
        prorata: false,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(40)
      expect(balance2).toBe(-40)
    })

    it("symmetric: when user2 pays BOTH, user1 owes half", () => {
      const expense = makeExpense({
        payerId: "u2",
        amount: new Decimal(100),
        participants: "BOTH",
        prorata: false,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(-50)
      expect(balance2).toBe(50)
    })
  })

  describe("prorata mode (BOTH)", () => {
    it("applies the user prorata percentages", () => {
      // user1=65%, user2=35%, amount=200 → user1 share=130, user2 share=70
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(200),
        participants: "BOTH",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(70) // 200 paid - 130 share
      expect(balance2).toBe(-70)
    })
  })

  describe("prorata mode (PAYER_ONLY)", () => {
    it("user1 pays for self → user2 contributes their prorata (35%)", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(100),
        participants: "PAYER_ONLY",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      // share1 = 100*(100-35)/100 = 65, share2 = 100*35/100 = 35
      // balance1 = 100 - 65 = 35, balance2 = 0 - 35 = -35
      expect(balance1).toBe(35)
      expect(balance2).toBe(-35)
    })

    it("user2 pays for self → user1 contributes their prorata (65%)", () => {
      const expense = makeExpense({
        payerId: "u2",
        amount: new Decimal(100),
        participants: "PAYER_ONLY",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(-65)
      expect(balance2).toBe(65)
    })
  })

  describe("prorata mode (OTHER_ONLY)", () => {
    it("user1 pays for user2 → user2 owes per user1 prorata (65%)", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(100),
        participants: "OTHER_ONLY",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      // share1 = 100*(100-65)/100 = 35, share2 = 100*65/100 = 65
      // balance1 = 100 - 35 = 65, balance2 = 0 - 65 = -65
      expect(balance1).toBe(65)
      expect(balance2).toBe(-65)
    })

    it("user2 pays for user1 → user1 owes per user2 prorata (35%)", () => {
      const expense = makeExpense({
        payerId: "u2",
        amount: new Decimal(100),
        participants: "OTHER_ONLY",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(-35)
      expect(balance2).toBe(35)
    })
  })

  describe("aggregation", () => {
    it("accumulates multiple expenses correctly", () => {
      const expenses = [
        makeExpense({
          id: "e1",
          payerId: "u1",
          amount: new Decimal(100),
          participants: "BOTH",
          prorata: false,
        }),
        makeExpense({
          id: "e2",
          payerId: "u2",
          amount: new Decimal(60),
          participants: "BOTH",
          prorata: false,
        }),
      ]
      const { balance1, balance2 } = calculateBalances(expenses, user1, user2)
      // u1: +100 -50 -30 = +20; u2: -50 +60 -30 = -20
      expect(balance1).toBe(20)
      expect(balance2).toBe(-20)
    })

    it("zero-sum invariant: balance1 + balance2 ≈ 0", () => {
      const expenses = [
        makeExpense({
          id: "e1",
          payerId: "u1",
          amount: new Decimal(123.45),
          participants: "BOTH",
          prorata: true,
        }),
        makeExpense({
          id: "e2",
          payerId: "u2",
          amount: new Decimal(78.9),
          participants: "OTHER_ONLY",
          prorata: true,
        }),
        makeExpense({
          id: "e3",
          payerId: "u1",
          amount: new Decimal(10),
          participants: "PAYER_ONLY",
          prorata: false,
        }),
      ]
      const { balance1, balance2 } = calculateBalances(expenses, user1, user2)
      expect(balance1 + balance2).toBeCloseTo(0, 10)
    })
  })

  describe("decimal precision", () => {
    it("handles fractional amounts without floating point drift", () => {
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal("0.1"),
        participants: "BOTH",
        prorata: false,
      })
      const { balance1, balance2 } = calculateBalances([expense], user1, user2)
      expect(balance1).toBe(0.05)
      expect(balance2).toBe(-0.05)
    })

    it("handles 0/100 prorata edge case", () => {
      const u1 = makeUser({ id: "u1", prorataPct: 100 })
      const u2 = makeUser({ id: "u2", prorataPct: 0 })
      const expense = makeExpense({
        payerId: "u1",
        amount: new Decimal(100),
        participants: "BOTH",
        prorata: true,
      })
      const { balance1, balance2 } = calculateBalances([expense], u1, u2)
      expect(balance1).toBe(0)
      expect(balance2).toBe(0)
    })
  })
})
