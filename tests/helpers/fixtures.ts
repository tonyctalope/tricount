import type { Expense, User } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    coupleId: "couple-1",
    email: "u1@example.com",
    name: "User 1",
    image: null,
    prorataPct: 50,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    emailVerified: null,
    ...overrides,
  } as User
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    coupleId: "couple-1",
    payerId: "user-1",
    description: "Test",
    amount: new Decimal(100),
    currency: "EUR",
    date: new Date("2026-05-01T00:00:00Z"),
    participants: "BOTH",
    prorata: false,
    archiveId: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  } as Expense
}
