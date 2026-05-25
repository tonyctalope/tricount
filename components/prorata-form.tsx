"use client"

import { useState, useTransition } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Slider } from "./ui/slider"
import { updateProrataPct } from "@/app/actions/expenses"
import { toast } from "sonner"

export function ProrataForm({ currentPct }: { currentPct: number }) {
  const [value, setValue] = useState(currentPct)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    startTransition(async () => {
      const result = await updateProrataPct(value)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Pourcentage mis à jour")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div>
        <Label htmlFor="prorataPct">Votre pourcentage : {value}%</Label>
        <div className="flex gap-4 items-center mt-2">
          <Slider
            id="prorataPct"
            min={0}
            max={100}
            step={1}
            value={[value]}
            onValueChange={([val]) => setValue(val)}
            disabled={isPending}
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value) || 0)}
            disabled={isPending}
            className="w-20"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Le pourcentage de votre partenaire sera automatiquement calculé (100 - {value} ={" "}
          {100 - value}%)
        </p>
      </div>

      <Button
        type="submit"
        disabled={isPending || value === currentPct}
        className="w-full sm:w-auto"
      >
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  )
}
