# Tricount

> Application web minimaliste de partage des dépenses **pour deux** (un couple, deux colocs…), avec calcul des soldes, dépenses récurrentes, archives mensuelles et mode prorata.

Pas de tableau partagé public, pas de groupes à N personnes, pas d'inscription libre : une instance, deux comptes Google autorisés, point.

## Fonctionnalités

- **Dépenses partagées** — création, édition, suppression. Par dépense, choix du payeur, des participants (50/50, payeur seul, autre seul) et de la devise (EUR par défaut).
- **Mode prorata** — chaque utilisateur a un pourcentage personnel (0–100 %) ; quand le prorata est activé sur une dépense, le partage suit ces pourcentages au lieu du 50/50.
- **Dépenses récurrentes** — des _templates_ (loyer, abonnements…) que vous ré-appliquez en un clic chaque mois (les dépenses créées portent la date du jour).
- **Archives mensuelles** — gelez la période courante sous un libellé (par défaut le mois précédent en français). Les archives sont consultables en lecture seule ; les dépenses récurrentes ne sont pas concernées.
- **Soldes en temps réel** — calculés côté serveur avec `Decimal` (pas de drift flottant). Affichage mobile et desktop.
- **Authentification stricte** — Google OAuth uniquement, avec une allowlist de **deux emails** définie en variable d'environnement. Toutes les opérations sont scopées au `coupleId` de l'utilisateur.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Turbopack) + [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/) — typecheck avec [`tsgo`](https://github.com/microsoft/typescript-go)
- [Prisma 6](https://www.prisma.io/) + PostgreSQL
- [NextAuth (Auth.js v5)](https://authjs.dev/) — JWT session, Google OAuth + Credentials dev
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- [Zod](https://zod.dev/) pour la validation des Server Actions
- [Vitest](https://vitest.dev/) pour les tests unitaires
- [oxlint](https://oxc.rs/docs/guide/usage/linter.html) + [Prettier](https://prettier.io/) pour lint et format
- [Bun](https://bun.sh/) comme runtime / package manager

## Démarrage rapide

### Prérequis

- [Bun](https://bun.sh) ≥ 1.0
- Docker + Docker Compose (recommandé pour PostgreSQL)
- Un projet Google Cloud avec OAuth 2.0 configuré

### 1. Installation

```bash
git clone <repo-url>
cd tricount
bun install
```

### 2. Variables d'environnement

Copiez le template et remplissez-le :

```bash
cp .env.example .env
```

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/tricount?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
ALLOWED_EMAILS="vous@example.com,partenaire@example.com"
```

Côté Google Cloud :

- Type d'application : **Application Web**
- Origines JS autorisées : `http://localhost:3000`
- URI de redirection : `http://localhost:3000/api/auth/callback/google`

### 3. Base de données

```bash
docker compose up -d postgres
bun prisma migrate deploy
bun prisma generate
```

### 4. Lancer

```bash
bun dev
```

Application disponible sur [http://localhost:3000](http://localhost:3000). À la première connexion, un `Couple` est créé ; à la seconde, le second compte y est rattaché automatiquement.

> **Dev shortcut** : en `NODE_ENV=development`, la page de connexion expose un bouton "Se connecter en tant que…" pour chaque email de l'allowlist, qui contourne Google OAuth.

### Tout-en-un avec Docker

Pour lancer app + base ensemble (utile pour les démos ou un déploiement minimal) :

```bash
cp .env.example .env.docker   # adapter DATABASE_URL=postgresql://user:password@postgres:5432/tricount
docker compose up --build
```

Le `Dockerfile.dev` installe les dépendances, génère le client Prisma, applique les migrations puis lance `bun dev`. Pour un build de production, voir le `Dockerfile` multi-stage (sortie `output: "standalone"` configurée dans `next.config.ts`).

## Développement

```bash
bun dev               # serveur de dev (Turbopack)
bun run build         # build production
bun start             # lancer le build

bun run lint          # oxlint
bun run format        # prettier --write
bun run format:check  # prettier --check
bun run typecheck     # tsgo --noEmit

bun run test          # suite Vitest (entièrement en mémoire, pas de DB requise)
bun run test:watch
bun run test:coverage

bun prisma studio                       # GUI Prisma
bun prisma migrate dev --name <name>    # créer/appliquer une migration
bun prisma migrate reset                # ⚠️ wipe + replay
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute lint, format check, typecheck et tests à chaque push.

## Architecture

```
app/
├── actions/              # Server Actions (mutations) — expenses / recurring / archives
├── api/auth/[...nextauth]/
├── auth/{signin,error}/
├── archives/             # liste + détail (lecture seule)
├── expenses/             # création + édition
├── recurring/            # templates : liste + création + édition
├── settings/             # réglage du pourcentage prorata
├── layout.tsx            # layout + fonts + providers
└── page.tsx              # dashboard (soldes + dépenses actives)

components/               # composants applicatifs + ui/ (shadcn)
lib/                      # auth, prisma, balance, session, archive-label, utils
prisma/                   # schema + migrations
tests/                    # vitest (lib/ + actions/)
```

### Modèle de données

- `Couple` — conteneur pour exactement 2 `User`, leurs `Expense`, `RecurringExpense` et `Archive`.
- `Expense` — montant `Decimal(12,2)`, devise, date, `participants ∈ {BOTH, PAYER_ONLY, OTHER_ONLY}`, `prorata: boolean`, `archiveId` nullable (null = période active, sinon dans une archive).
- `RecurringExpense` — même schéma sans `date` ni `archiveId`. Sert de _template_ ré-appliqué à la demande.
- `Archive` — snapshot figé d'une période (`label` libre, `archivedAt`). Les expenses migrent dedans via mise à jour du FK `archiveId`.
- `User` — `prorataPct: Int` (défaut 50), `coupleId` nullable.

### Calcul des soldes

`lib/balance.ts` parcourt les dépenses, crédite le payeur du montant total, puis débite chaque utilisateur de sa part. La part dépend du couple `(participants, prorata)`. Tout passe par `Decimal` ; conversion en `number` uniquement au moment de renvoyer le résultat.

Le prorata s'applique même aux dépenses `PAYER_ONLY`/`OTHER_ONLY` (cas d'une dépense personnelle où l'autre contribue partiellement selon son pourcentage).

## Sécurité

- Toutes les Server Actions appellent `getCurrentUser()` et rejettent les requêtes non authentifiées ou sans `coupleId`.
- Toutes les requêtes Prisma sont scopées au `coupleId` de l'utilisateur courant.
- Allowlist stricte (`ALLOWED_EMAILS`) appliquée dans le callback `signIn` de NextAuth.
- Validation Zod systématique en entrée des Server Actions.
- Les requêtes de la période active filtrent sur `archiveId: null` (impossible de muter une dépense archivée — l'action renvoie `Dépense introuvable ou archivée`).

## Licence

MIT
