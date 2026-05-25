"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { User, RecurringExpense } from "@prisma/client"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import { createRecurringExpense, updateRecurringExpense } from "@/app/actions/recurring"
import { toast } from "sonner"

type RecurringExpenseWithNumberAmount = Omit<RecurringExpense, "amount"> & {
  amount: number
}

export function RecurringExpenseForm({
  users,
  expense,
}: {
  users: User[]
  expense?: RecurringExpenseWithNumberAmount
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [prorata, setProrata] = useState(expense?.prorata ?? false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = expense
        ? await updateRecurringExpense(expense.id, formData)
        : await createRecurringExpense(formData)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(expense ? "Template mis à jour" : "Template créé")
        router.push("/recurring")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={expense?.description}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Montant (€)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          defaultValue={expense?.amount.toString()}
          required
          disabled={isPending}
        />
      </div>

      <input type="hidden" name="currency" value="EUR" />

      <div className="space-y-1.5">
        <Label htmlFor="payerId">Payeur</Label>
        <Select name="payerId" defaultValue={expense?.payerId} required disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionnez le payeur" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="participants">Participants</Label>
        <Select
          name="participants"
          defaultValue={expense?.participants ?? "BOTH"}
          required
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionnez les participants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOTH">Les deux (50/50)</SelectItem>
            <SelectItem value="PAYER_ONLY">Payeur uniquement</SelectItem>
            <SelectItem value="OTHER_ONLY">Autre personne uniquement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-start space-x-2 pt-1">
        <Checkbox
          id="prorata"
          name="prorata"
          value="true"
          checked={prorata}
          onCheckedChange={(checked) => setProrata(checked as boolean)}
          disabled={isPending}
          className="mt-0.5"
        />
        <Label htmlFor="prorata" className="cursor-pointer text-sm leading-snug">
          Appliquer le prorata (selon les pourcentages définis dans les paramètres)
        </Label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/recurring")}
          disabled={isPending}
          className="sm:w-auto"
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isPending} className="sm:w-auto">
          {isPending ? "Enregistrement..." : expense ? "Mettre à jour" : "Créer"}
        </Button>
      </div>
    </form>
  )
}
