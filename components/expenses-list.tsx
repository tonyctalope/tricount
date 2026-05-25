"use client"

import { useState } from "react"
import { Expense, User } from "@prisma/client"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { deleteExpense } from "@/app/actions/expenses"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog"

type ExpenseWithPayer = Omit<Expense, "amount"> & {
  amount: number
  payer: User
}

export function ExpensesList({
  expenses,
  readOnly = false,
}: {
  expenses: ExpenseWithPayer[]
  users: User[]
  currentUserId: string
  readOnly?: boolean
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    const result = await deleteExpense(deleteId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Dépense supprimée")
    }

    setIsDeleting(false)
    setDeleteId(null)
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucune dépense pour le moment. Ajoutez-en une pour commencer !
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold leading-tight truncate">{expense.description}</h3>
                    {expense.prorata && (
                      <span className="text-[10px] sm:text-xs bg-secondary px-1.5 py-0.5 rounded shrink-0">
                        Prorata
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {expense.payer.name || expense.payer.email}
                    {" · "}
                    {expense.participants === "BOTH" && "Partagée"}
                    {expense.participants === "PAYER_ONLY" && "Perso (payeur)"}
                    {expense.participants === "OTHER_ONLY" && "Perso (autre)"}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                    {new Date(expense.date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="font-bold text-base sm:text-lg whitespace-nowrap">
                    {expense.amount.toFixed(2)}{" "}
                    {expense.currency === "EUR" ? "€" : expense.currency}
                  </p>
                  {!readOnly && (
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                        <Link href={`/expenses/${expense.id}/edit`} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteId(expense.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La dépense sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
