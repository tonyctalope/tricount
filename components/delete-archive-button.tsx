"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
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
import { deleteArchive } from "@/app/actions/archives"
import { toast } from "sonner"

export function DeleteArchiveButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirmText !== "SUPPRIMER") {
      toast.error("Veuillez taper SUPPRIMER pour confirmer")
      return
    }

    startTransition(async () => {
      const result = await deleteArchive(id)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Archive supprimée")
        setOpen(false)
        setConfirmText("")
        router.push("/archives")
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmText("")
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0" aria-label="Supprimer l'archive">
          <Trash2 className="h-4 w-4 sm:mr-2 text-destructive" />
          <span className="hidden sm:inline">Supprimer</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer l&apos;archive « {label} » ?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Cette action est irréversible. Toutes les dépenses de cette archive seront
              définitivement supprimées.
            </span>
            <span className="block font-semibold">
              Pour confirmer, tapez « SUPPRIMER » ci-dessous :
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="delete-archive-confirm">Confirmation</Label>
          <Input
            id="delete-archive-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Tapez SUPPRIMER"
            disabled={isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={isPending || confirmText !== "SUPPRIMER"}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Suppression..." : "Supprimer définitivement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
