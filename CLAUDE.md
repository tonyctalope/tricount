# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tricount App is a couple expense tracking MVP built with Next.js 16 (App Router), React 19, TypeScript, Prisma ORM and NextAuth (Auth.js v5). It is designed for **exactly 2 users** (a couple, two roommates…) sharing a single instance — there is no concept of N-person groups. Operations are always scoped to a `coupleId`.

## Development Commands

### Essential

```bash
bun install              # install dependencies
bun dev                  # dev server (Turbopack)
bun run build            # production build (Turbopack, output: "standalone")
bun start                # serve the production build
```

### Quality

```bash
bun run lint             # oxlint
bun run format           # prettier --write .
bun run format:check     # prettier --check .
bun run typecheck        # tsgo --noEmit  (Microsoft's native-preview TS compiler)
```

CI (`.github/workflows/ci.yml`) runs lint + format:check + typecheck + test on every push.

### Tests

```bash
bun run test                                # full suite once
bun run test:watch                          # watch mode
bun run test tests/lib/balance.test.ts      # single file
bun run test -- -t "prorata"                # filter by name
bun run test:coverage                       # text + HTML in coverage/
```

### Database

```bash
bun prisma generate                          # regenerate client after schema changes
bun prisma migrate dev --name <name>         # create + apply a migration
bun prisma migrate deploy                    # apply existing migrations (prod / docker entrypoint)
bun prisma migrate reset                     # WARNING: wipes the DB
bun prisma studio                            # GUI
```

### Docker

```bash
docker compose up -d postgres                # just the DB (typical local dev)
docker compose up --build                    # full app + DB (uses .env.docker, Dockerfile.dev)
```

`Dockerfile.dev` runs `docker-entrypoint.sh`: install deps → `prisma generate` → `prisma migrate deploy` → `bun dev`. `Dockerfile` is a multi-stage production build (deps → builder → `node:alpine` runner serving `.next/standalone`).

## Architecture

### Authentication Flow

- NextAuth (Auth.js v5) with JWT session strategy (`session: { strategy: "jwt" }`).
- Two providers configured in `lib/auth.ts`:
  - **Google OAuth** (always).
  - **Credentials "dev"** (only when `NODE_ENV === "development"`): allows logging in as any email from the allowlist without going through Google. The sign-in page renders one button per allowlisted email in dev.
- The `signIn` callback (`lib/auth.ts`) blocks any email not present in `ALLOWED_EMAILS`.
- The `jwt` callback handles **automatic couple creation/attachment**:
  - On first login of an allowlisted user with no `coupleId`, a fresh `Couple` is created and the user attached to it.
  - On the second login, the new user is attached to the existing couple that has only 1 user (most-recent first).
  - The `coupleId` is then stored on the JWT and exposed on `session.user.coupleId` via the `session` callback.
- `lib/session.ts` exposes `getCurrentUser()` which returns `session.user` (with `id` and `coupleId`).
- Types extended in `types/next-auth.d.ts` (`Session.user.coupleId`, `JWT.coupleId`).

### Data Model (`prisma/schema.prisma`)

- **Couple** — has a `label` (default `"Notre couple"`), holds users + expenses + recurringExpenses + archives.
- **User** — `prorataPct: Int @default(50)`, nullable `coupleId`. Standard Auth.js fields (`email`, `name`, `image`, `emailVerified`) + relations to `Account`/`Session`.
- **Expense** — `amount: Decimal @db.Decimal(12, 2)`, `currency` (default EUR), `date`, `participants: ParticipantsType`, `prorata: Boolean`, nullable `archiveId`.
  - `archiveId = null` → active period.
  - `archiveId = <id>` → belongs to a frozen archive.
  - `onDelete: SetNull` on the archive FK (deleting an archive turns expenses back into orphans — but `deleteArchive` deletes them too in the same transaction).
- **RecurringExpense** — template; same fields as `Expense` minus `date` and `archiveId`. Applied on demand via `applyAllRecurringExpenses()` (creates real expenses dated `now`).
- **Archive** — `label: String` (user-chosen, e.g. "Mai 2026"), `archivedAt: DateTime`. Owns its expenses by FK.
- **ParticipantsType** enum: `BOTH | PAYER_ONLY | OTHER_ONLY`.
- **Account / Session / VerificationToken** — Auth.js tables.

### Balance Calculation Logic

Core algorithm in `lib/balance.ts`:

1. Credit the payer with the full expense amount.
2. Compute shares per user from `(participants, prorata, payerId, user.prorataPct)`:
   - **Prorata mode** uses the users' `prorataPct` percentages — even for `PAYER_ONLY` / `OTHER_ONLY`, where the non-beneficiary still contributes their `prorataPct`.
   - **Non-prorata mode** is a straight 50/50 (`BOTH`), 100/0 (`PAYER_ONLY`) or 0/100 (`OTHER_ONLY`).
3. Debit each user by their share.
4. Return `{ balance1, balance2 }` as `number` (only conversion point — internals stay `Decimal`).

`lib/archive-label.ts` provides `getDefaultArchiveLabel()` — returns the **previous** month's name in French, capitalised (e.g. on 2026-05-26 returns `"Avril 2026"`). Used as the default label in the archive dialog.

### Server Actions

All mutations are `"use server"`. They follow the same shape: `getCurrentUser()` → Zod parse → Prisma call → `revalidatePath(...)` → return `{ success } | { error }`.

**`app/actions/expenses.ts`**:

- `createExpense(formData)`
- `updateExpense(id, formData)` — refuses if the expense is archived (filters `archiveId: null`).
- `deleteExpense(id)` — same archived-refusal.
- `updateProrataPct(prorataPct)` — updates the current user's `prorataPct` (0–100).

**`app/actions/recurring.ts`**:

- `createRecurringExpense(formData)`
- `updateRecurringExpense(id, formData)`
- `deleteRecurringExpense(id)`
- `applyAllRecurringExpenses()` — `prisma.expense.createMany` with one entry per template, `date: new Date()`. Returns `{ count }` on success.

**`app/actions/archives.ts`**:

- `archiveCurrentPeriod(label)` — runs inside `prisma.$transaction(async (tx) => …)`: counts active expenses, creates an `Archive`, reassigns all active expenses to it via `updateMany`. Returns early with `"Aucune dépense à archiver"` if the count is 0.
- `deleteArchive(id)` — array-form `$transaction`: `expense.deleteMany({ archiveId, coupleId })` + `archive.delete({ id })`. Irreversible.

**Security invariants** (enforced in every action):

- Reject if `!user || !user.coupleId` → `"Non authentifié"`.
- Always scope writes via a `findFirst({ where: { id, coupleId } })` lookup before update/delete → on missing row, return `"introuvable"` / `"introuvable ou archivée"`.
- Active-period queries always filter on `archiveId: null`.

### Pages & Components

Pages (App Router, all server components unless noted):

- `app/page.tsx` — Dashboard: balances + active expenses + actions (apply-recurring, archive, new expense). Renders "En attente du partenaire" if the couple has fewer than 2 users.
- `app/archives/page.tsx` — Archives list with per-archive totals + your saved balance.
- `app/archives/[id]/page.tsx` — Read-only archive detail (uses `ExpensesList readOnly`). **Note**: `params` is `Promise<{ id: string }>` (Next 15+ async params); always `await params`.
- `app/expenses/{new,[id]/edit}/page.tsx` — Wrap `ExpenseForm`.
- `app/recurring/{page,new,[id]/edit}/page.tsx` — Recurring templates list + form.
- `app/settings/page.tsx` — Prorata percentage adjustment via `ProrataForm`.
- `app/auth/{signin,error}/page.tsx` — Custom auth pages. Signin shows the dev Credentials buttons when `NODE_ENV === "development"`.

Client components in `components/` (all `"use client"`):

- `expense-form.tsx`, `recurring-expense-form.tsx` — Shared create/edit forms; submit via Server Actions using `useTransition`, surface errors with `sonner` toasts.
- `expenses-list.tsx` — Expense rows with edit/delete buttons. Accepts a `readOnly` prop (used in archive detail).
- `recurring-expenses-list.tsx`, `apply-recurring-button.tsx` — Recurring UI.
- `archive-button.tsx` — `AlertDialog` prompting for a label, defaults to `getDefaultArchiveLabel()`.
- `delete-archive-button.tsx` — Typed-confirmation deletion.
- `prorata-form.tsx` — Slider/input for `prorataPct`.
- `ui/` — shadcn/ui primitives (`button`, `card`, `input`, `label`, `select`, `slider`, `checkbox`, `alert-dialog`, `sonner`).

## Important Patterns

### Path Aliases

`@/` resolves from project root (`tsconfig.json`). Use it everywhere:

```typescript
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
```

### Validation

Server Actions validate FormData via Zod. Example: `expenseSchema` at the top of `app/actions/expenses.ts`. Always parse before touching Prisma; the `z.ZodError` branch in the `catch` surfaces the first issue's message.

### Revalidation

After every mutation, call `revalidatePath(...)` for affected routes:

```typescript
revalidatePath("/")
revalidatePath("/archives")
revalidatePath(`/expenses/${id}/edit`)
```

### Decimal Handling

Money is `Decimal(12,2)` in Prisma. Build amounts via `new Decimal(value)` from `@prisma/client/runtime/library`. Pages convert to `number` only when shipping data to Client Components (`amount: Number(expense.amount)`).

### Next 16 async params

Dynamic-route page props use `params: Promise<{ id: string }>`. Always `await params` before destructuring.

### `next.config.ts`

```ts
output: "standalone" // for Dockerfile production build
serverExternalPackages: ["@prisma/client", ".prisma/client"] // Prisma compatibility with Turbopack/bundling
```

## Environment Variables

| Var                    | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                                                |
| `NEXTAUTH_URL`         | Application URL (e.g. `http://localhost:3000`)                              |
| `NEXTAUTH_SECRET`      | JWT signing secret (`openssl rand -base64 32`)                              |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                                      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                                  |
| `ALLOWED_EMAILS`       | Comma-separated allowlist (exactly 2 emails for the app to work end-to-end) |

`.env` is used by local Bun dev. `.env.docker` is loaded by the app container in `docker compose up --build` — adjust `DATABASE_URL` to use the `postgres` service hostname (`postgresql://user:password@postgres:5432/tricount`).

## Docker / Local Postgres

`docker-compose.yml` defines two services: `postgres` (with healthcheck) and `app` (built from `Dockerfile.dev`). The postgres credentials used in compose are:

- Database: `tricount`
- User: `user`
- Password: `password`
- Port: `5432`

The local dev workflow is usually `docker compose up -d postgres` + `bun dev` on the host.

## Testing

Vitest, runs entirely in memory (no DB). Config in `vitest.config.ts` (resolves the `@/` alias from `tsconfig.json`, `environment: "node"`, `clearMocks: true`).

### Layout

```
tests/
├── helpers/
│   ├── fixtures.ts        # makeUser / makeExpense factories
│   └── action-mocks.ts    # Shared prisma + session + revalidatePath mocks
├── lib/
│   ├── balance.test.ts        # Balance algorithm (every participant × prorata combo)
│   ├── archive-label.test.ts  # Default French month label
│   └── utils.test.ts          # cn() helper
└── actions/
    ├── expenses.test.ts   # Server Actions: create/update/delete/prorata
    ├── recurring.test.ts  # Recurring templates + applyAll
    └── archives.test.ts   # archiveCurrentPeriod + deleteArchive
```

### Conventions

- **Pure logic** (`lib/`): test against real `Decimal` values — no mocks needed.
- **Server Actions** (`app/actions/`): mock `next/cache`, `@/lib/prisma`, and `@/lib/session` via `vi.mock` at the top of the file. Always use the helpers from `tests/helpers/action-mocks.ts` (`prismaMock`, `authedAs()`, `unauthed()`, `makeFormData()`, `resetMocks()`) instead of redefining mocks per test.
- **`prisma.$transaction` callback form** (used by `archiveCurrentPeriod`): forward the callback to the mock with `prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock))` so inner calls land on the same mocked client.
- **`prisma.$transaction` array form** (used by `deleteArchive`): make each inner Prisma call return a sentinel via `.mockReturnValue(...)` and assert `$transaction` was called with the expected array.
- Always cover the **unauthenticated** path (`unauthed()`) **and** the **no-couple** path (`authedAs({ coupleId: null })`) for every Server Action — these are the security invariants of the app.
- For actions that look up an existing row, also cover the **scoping** path (foreign `coupleId` → `findFirst` returns null → action returns `"introuvable"`).
