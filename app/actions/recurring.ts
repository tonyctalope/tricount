"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import { Decimal } from "@prisma/client/runtime/library"

const recurringExpenseSchema = z.object({
  description: z.string().min(1, "La description est requise"),
  amount: z.number().positive("Le montant doit être positif"),
  currency: z.string().default("EUR"),
  payerId: z.string(),
  participants: z.enum(["BOTH", "PAYER_ONLY", "OTHER_ONLY"]),
  prorata: z.boolean().default(false),
})

export async function createRecurringExpense(formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const data = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      currency: (formData.get("currency") as string) || "EUR",
      payerId: formData.get("payerId") as string,
      participants: formData.get("participants") as "BOTH" | "PAYER_ONLY" | "OTHER_ONLY",
      prorata: formData.get("prorata") === "true",
    }

    const validated = recurringExpenseSchema.parse(data)

    await prisma.recurringExpense.create({
      data: {
        coupleId: user.coupleId,
        description: validated.description,
        amount: new Decimal(validated.amount),
        currency: validated.currency,
        payerId: validated.payerId,
        participants: validated.participants,
        prorata: validated.prorata,
      },
    })

    revalidatePath("/recurring")
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" }
    }
    return { error: "Une erreur est survenue" }
  }
}

export async function updateRecurringExpense(id: string, formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const existing = await prisma.recurringExpense.findFirst({
      where: { id, coupleId: user.coupleId },
    })

    if (!existing) {
      return { error: "Dépense récurrente introuvable" }
    }

    const data = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      currency: (formData.get("currency") as string) || "EUR",
      payerId: formData.get("payerId") as string,
      participants: formData.get("participants") as "BOTH" | "PAYER_ONLY" | "OTHER_ONLY",
      prorata: formData.get("prorata") === "true",
    }

    const validated = recurringExpenseSchema.parse(data)

    await prisma.recurringExpense.update({
      where: { id },
      data: {
        description: validated.description,
        amount: new Decimal(validated.amount),
        currency: validated.currency,
        payerId: validated.payerId,
        participants: validated.participants,
        prorata: validated.prorata,
      },
    })

    revalidatePath("/recurring")
    revalidatePath(`/recurring/${id}/edit`)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation error" }
    }
    return { error: "Une erreur est survenue" }
  }
}

export async function deleteRecurringExpense(id: string) {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const existing = await prisma.recurringExpense.findFirst({
      where: { id, coupleId: user.coupleId },
    })

    if (!existing) {
      return { error: "Dépense récurrente introuvable" }
    }

    await prisma.recurringExpense.delete({
      where: { id },
    })

    revalidatePath("/recurring")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { error: "Une erreur est survenue" }
  }
}

export async function applyAllRecurringExpenses() {
  try {
    const user = await getCurrentUser()
    if (!user || !user.coupleId) {
      return { error: "Non authentifié" }
    }

    const templates = await prisma.recurringExpense.findMany({
      where: { coupleId: user.coupleId },
    })

    if (templates.length === 0) {
      return { error: "Aucune dépense récurrente à appliquer" }
    }

    const now = new Date()

    await prisma.expense.createMany({
      data: templates.map((t) => ({
        coupleId: t.coupleId,
        payerId: t.payerId,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        date: now,
        participants: t.participants,
        prorata: t.prorata,
      })),
    })

    revalidatePath("/")
    return { success: true, count: templates.length }
  } catch {
    return { error: "Une erreur est survenue" }
  }
}
