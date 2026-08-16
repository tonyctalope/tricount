import type { Prisma } from "@prisma/client"

/**
 * Pourcentages de prorata figés au moment de l'archivage, indexés par userId.
 *
 * Sans ce gel, les soldes d'une archive sont recalculés avec les prorata
 * *courants* des utilisateurs : changer son pourcentage dans les paramètres
 * réécrirait rétroactivement les soldes de toutes les périodes archivées.
 */
export type ProrataSnapshot = Record<string, number>

export function buildProrataSnapshot(users: { id: string; prorataPct: number }[]): ProrataSnapshot {
  return Object.fromEntries(users.map((u) => [u.id, u.prorataPct]))
}

/**
 * Relit un snapshot stocké en colonne Json. Renvoie `null` si la valeur est
 * absente ou inexploitable — l'appelant retombe alors sur les prorata courants
 * (cas des archives créées avant l'introduction du gel).
 */
export function parseProrataSnapshot(
  value: Prisma.JsonValue | null | undefined,
): ProrataSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const snapshot: ProrataSnapshot = {}
  for (const [userId, pct] of Object.entries(value)) {
    if (typeof pct === "number" && Number.isFinite(pct)) {
      snapshot[userId] = pct
    }
  }

  return Object.keys(snapshot).length > 0 ? snapshot : null
}
