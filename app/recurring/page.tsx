import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowLeft } from "lucide-react"
import { RecurringExpensesList } from "@/components/recurring-expenses-list"

export default async function RecurringPage() {
  const user = await getCurrentUser()

  if (!user || !user.coupleId) {
    redirect("/auth/signin")
  }

  const coupleData = await prisma.couple.findUnique({
    where: { id: user.coupleId },
    include: {
      users: true,
      recurringExpenses: {
        include: {
          payer: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!coupleData || coupleData.users.length < 2) {
    redirect("/")
  }

  const recurringExpenses = coupleData.recurringExpenses.map((expense) => ({
    ...expense,
    amount: Number(expense.amount),
  }))

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-8">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          <h1 className="text-base sm:text-lg font-semibold truncate">Récurrentes</h1>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/recurring/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Ajouter un template
            </Link>
          </Button>
          <span className="sm:hidden w-16" aria-hidden />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="p-4 sm:p-6 sm:pb-2">
            <CardTitle className="text-sm sm:text-base">Comment ça marche ?</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Les templates de dépenses récurrentes survivent au reset mensuel. Utilisez le bouton
              &quot;Appliquer les récurrentes&quot; sur le tableau de bord pour les ajouter
              d&apos;un coup avec la date du jour.
            </p>
          </CardContent>
        </Card>

        <RecurringExpensesList expenses={recurringExpenses} />
      </main>

      <Button
        asChild
        size="lg"
        className="sm:hidden fixed bottom-5 right-5 h-14 w-14 rounded-full shadow-lg p-0 z-20"
        aria-label="Ajouter un template"
      >
        <Link href="/recurring/new">
          <PlusCircle className="!h-6 !w-6" />
        </Link>
      </Button>
    </div>
  )
}
