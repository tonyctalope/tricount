import { vi } from "vitest"

/**
 * Shared mocks for Server Action tests.
 *
 * Server Actions import three things we don't want to hit for real:
 *   - next/cache (revalidatePath)
 *   - @/lib/prisma (database)
 *   - @/lib/session (NextAuth)
 *
 * Tests `import { prismaMock, sessionMock, revalidatePathMock } from "./helpers/action-mocks"`
 * AFTER calling vi.mock on those modules at the top of the test file.
 */

export const prismaMock = {
  expense: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  recurringExpense: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  archive: {
    create: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

export const sessionMock = {
  getCurrentUser: vi.fn(),
}

export const revalidatePathMock = vi.fn()

export function resetMocks() {
  for (const model of Object.values(prismaMock)) {
    if (typeof model === "function") {
      ;(model as ReturnType<typeof vi.fn>).mockReset()
      continue
    }
    for (const fn of Object.values(model)) {
      ;(fn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
  sessionMock.getCurrentUser.mockReset()
  revalidatePathMock.mockReset()
}

export function authedAs(
  overrides: Partial<{ id: string; coupleId: string | null; email: string }> = {},
) {
  sessionMock.getCurrentUser.mockResolvedValue({
    id: "user-1",
    coupleId: "couple-1",
    email: "u1@example.com",
    ...overrides,
  })
}

export function unauthed() {
  sessionMock.getCurrentUser.mockResolvedValue(null)
}

export function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    fd.set(k, v)
  }
  return fd
}
