"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog"
import { applyAllRecurringExpenses } from "@/app/actions/recurring"
import { toast } from "sonner"
import { RotateCw } from "lucide-react"

export function ApplyRecurringButton({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleApply = async () => {
    startTransition(async () => {
      const result = await applyAllRecurringExpenses()

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${result.count} dépense(s) récurrente(s) appliquée(s)`)
        setOpen(false)
        router.refresh()
      }
    })
  }

  if (count === 0) return null

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <RotateCw className="h-4 w-4 mr-2" />
          Appliquer les récurrentes ({count})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Appliquer les dépenses récurrentes ?</AlertDialogTitle>
          <AlertDialogDescription>
            {count} dépense(s) récurrente(s) seront ajoutées aux dépenses du mois avec la date
            d&apos;aujourd&apos;hui.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleApply()
            }}
            disabled={isPending}
          >
            {isPending ? "Application..." : "Appliquer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
