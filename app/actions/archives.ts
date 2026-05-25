"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"

const labelSchema = z
  .string()
  .trim()
  .min(1, "Le nom de l'archive est requis")
  .max(100, "Le nom est trop long")

export async function archiveCurrentPeriod(rawLabel: string) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const label = labelSchema.parse(rawLabel)
    const coupleId = user.coupleId

    const result = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.expense.count({
        where: { coupleId, archiveId: null },
      })

      if (activeCount === 0) {
        return { error: "Aucune dépense à archiver" as const }
      }

      const archive = await tx.archive.create({
        data: { coupleId, label },
      })

      await tx.expense.updateMany({
        where: { coupleId, archiveId: null },
        data: { archiveId: archive.id },
      })

      return { success: true as const, archiveId: archive.id }
    })

    if ("error" in result) {
      return result
    }

    revalidatePath("/")
    revalidatePath("/archives")
    return { success: true, archiveId: result.archiveId }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" }
    }
    return { error: "Une erreur est survenue" }
  }
}

export async function deleteArchive(id: string) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const coupleId = user.coupleId

    const existing = await prisma.archive.findFirst({
      where: { id, coupleId },
    })

    if (!existing) {
      return { error: "Archive introuvable" }
    }

    await prisma.$transaction([
      prisma.expense.deleteMany({ where: { archiveId: id, coupleId } }),
      prisma.archive.delete({ where: { id } }),
    ])

    revalidatePath("/")
    revalidatePath("/archives")
    return { success: true }
  } catch {
    return { error: "Une erreur est survenue" }
  }
}
