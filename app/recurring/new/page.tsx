import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { RecurringExpenseForm } from "@/components/recurring-expense-form"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function NewRecurringExpensePage() {
  const user = await getCurrentUser()

  if (!user || !user.coupleId) {
    redirect("/auth/signin")
  }

  const couple = await prisma.couple.findUnique({
    where: { id: user.coupleId },
    include: {
      users: true,
    },
  })

  if (!couple || couple.users.length < 2) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/recurring">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          <h1 className="text-base sm:text-lg font-semibold truncate">Nouvelle récurrente</h1>
          <span className="w-16" aria-hidden />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-4 sm:p-6">
            <RecurringExpenseForm users={couple.users} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
