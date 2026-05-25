"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
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
import { archiveCurrentPeriod } from "@/app/actions/archives"
import { toast } from "sonner"

export function ArchiveButton({ defaultLabel }: { defaultLabel: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(defaultLabel)
  const [isPending, startTransition] = useTransition()

  const handleArchive = () => {
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error("Le nom de l'archive est requis")
      return
    }

    startTransition(async () => {
      const result = await archiveCurrentPeriod(trimmed)

      if ("error" in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Période archivée : ${trimmed}`)
        setOpen(false)
        setLabel(defaultLabel)
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setLabel(defaultLabel)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <Archive className="h-4 w-4 mr-2" />
          Archiver
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archiver la période courante</AlertDialogTitle>
          <AlertDialogDescription>
            Toutes les dépenses actives seront déplacées dans une archive consultable depuis la page
            Archives. Les dépenses récurrentes ne sont pas concernées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="archive-label">Nom de l&apos;archive</Label>
          <Input
            id="archive-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Mai 2026"
            disabled={isPending}
            maxLength={100}
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleArchive()
            }}
            disabled={isPending || !label.trim()}
          >
            {isPending ? "Archivage..." : "Archiver"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
