"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { Decimal } from "@prisma/client/runtime/library"

const expenseSchema = z.object({
  description: z.string().min(1, "La description est requise"),
  amount: z.number().positive("Le montant doit être positif"),
  date: z.date(),
  currency: z.string().default("EUR"),
  payerId: z.string(),
  participants: z.enum(["BOTH", "PAYER_ONLY", "OTHER_ONLY"]),
  prorata: z.boolean().default(false),
})

export async function createExpense(formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const data = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      date: new Date(formData.get("date") as string),
      currency: (formData.get("currency") as string) || "EUR",
      payerId: formData.get("payerId") as string,
      participants: formData.get("participants") as "BOTH" | "PAYER_ONLY" | "OTHER_ONLY",
      prorata: formData.get("prorata") === "true",
    }

    const validated = expenseSchema.parse(data)

    await prisma.expense.create({
      data: {
        coupleId: user.coupleId,
        description: validated.description,
        amount: new Decimal(validated.amount),
        date: validated.date,
        currency: validated.currency,
        payerId: validated.payerId,
        participants: validated.participants,
        prorata: validated.prorata,
      },
    })

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" }
    }
    return { error: "Une erreur est survenue" }
  }
}

export async function updateExpense(id: string, formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const existing = await prisma.expense.findFirst({
      where: { id, coupleId: user.coupleId, archiveId: null },
    })

    if (!existing) {
      return { error: "Dépense introuvable ou archivée" }
    }

    const data = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      date: new Date(formData.get("date") as string),
      currency: (formData.get("currency") as string) || "EUR",
      payerId: formData.get("payerId") as string,
      participants: formData.get("participants") as "BOTH" | "PAYER_ONLY" | "OTHER_ONLY",
      prorata: formData.get("prorata") === "true",
    }

    const validated = expenseSchema.parse(data)

    await prisma.expense.update({
      where: { id },
      data: {
        description: validated.description,
        amount: new Decimal(validated.amount),
        date: validated.date,
        currency: validated.currency,
        payerId: validated.payerId,
        participants: validated.participants,
        prorata: validated.prorata,
      },
    })

    revalidatePath("/")
    revalidatePath(`/expenses/${id}/edit`)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" }
    }
    return { error: "Une erreur est survenue" }
  }
}

export async function deleteExpense(id: string) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const existing = await prisma.expense.findFirst({
      where: { id, coupleId: user.coupleId, archiveId: null },
    })

    if (!existing) {
      return { error: "Dépense introuvable ou archivée" }
    }

    await prisma.expense.delete({
      where: { id },
    })

    revalidatePath("/")
    return { success: true }
  } catch {
    return { error: "Une erreur est survenue" }
  }
}

export async function updateProrataPct(prorataPct: number) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { error: "Non authentifié" }
    }

    if (prorataPct < 0 || prorataPct > 100) {
      return { error: "Le pourcentage doit être entre 0 et 100" }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { prorataPct },
    })

    revalidatePath("/settings")
    return { success: true }
  } catch {
    return { error: "Une erreur est survenue" }
  }
}
