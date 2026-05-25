import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { calculateBalances } from "@/lib/balance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, Settings, Archive, Repeat } from "lucide-react"
import { ExpensesList } from "@/components/expenses-list"
import { ApplyRecurringButton } from "@/components/apply-recurring-button"
import { ArchiveButton } from "@/components/archive-button"
import { getDefaultArchiveLabel } from "@/lib/archive-label"

export default async function Dashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/signin")
  }

  if (!user.coupleId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Couple non configuré</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Veuillez attendre que votre partenaire se connecte également.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const coupleData = await prisma.couple.findUnique({
    where: { id: user.coupleId },
    include: {
      users: true,
      expenses: {
        where: { archiveId: null },
        include: {
          payer: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })

  if (!coupleData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Couple introuvable</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const recurringCount = await prisma.recurringExpense.count({
    where: { coupleId: user.coupleId },
  })

  if (!coupleData || coupleData.users.length < 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>En attente du partenaire</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Partagez l'application avec votre partenaire pour commencer.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [user1, user2] = coupleData.users
  const currentUserData = coupleData.users.find((u) => u.email === user.email)!
  const partnerData = coupleData.users.find((u) => u.email !== user.email)!

  // Calculer les balances avec les données Prisma (Decimal)
  const { balance1, balance2 } = calculateBalances(coupleData.expenses, user1, user2)

  // Convertir les Decimal en nombres pour les Client Components
  const couple = {
    ...coupleData,
    expenses: coupleData.expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    })),
  }

  const myBalance = currentUserData.id === user1.id ? balance1 : balance2
  const partnerBalance = currentUserData.id === user1.id ? balance2 : balance1

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-8">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <h1 className="text-lg sm:text-2xl font-bold truncate">{couple.label}</h1>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            <Button
              asChild
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label="Récurrentes"
            >
              <Link href="/recurring">
                <Repeat className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label="Paramètres"
            >
              <Link href="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label="Archives"
            >
              <Link href="/archives">
                <Archive className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/recurring">
                <Repeat className="h-4 w-4 mr-2" />
                Récurrentes
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/settings">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/archives">
                <Archive className="h-4 w-4 mr-2" />
                Archives
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="mb-6 sm:hidden">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 divide-x">
              <div className="pr-3">
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  Vous
                  {currentUserData.name && (
                    <span className="text-muted-foreground/70">
                      {" "}
                      · {currentUserData.name.split(" ")[0]}
                    </span>
                  )}
                </p>
                <p
                  className={`text-2xl font-bold leading-tight ${myBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {myBalance >= 0 ? "+" : ""}
                  {myBalance.toFixed(2)} €
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {myBalance > 0 && "On vous doit"}
                  {myBalance < 0 && "Vous devez"}
                  {myBalance === 0 && "À jour"}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  Partenaire
                  {partnerData.name && (
                    <span className="text-muted-foreground/70">
                      {" "}
                      · {partnerData.name.split(" ")[0]}
                    </span>
                  )}
                </p>
                <p
                  className={`text-2xl font-bold leading-tight ${partnerBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {partnerBalance >= 0 ? "+" : ""}
                  {partnerBalance.toFixed(2)} €
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {partnerBalance > 0 && "On lui doit"}
                  {partnerBalance < 0 && "Il/elle doit"}
                  {partnerBalance === 0 && "À jour"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="hidden sm:grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Votre solde ({currentUserData.name || currentUserData.email})</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${myBalance >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {myBalance >= 0 ? "+" : ""}
                {myBalance.toFixed(2)} €
              </p>
              {myBalance > 0 && (
                <p className="text-sm text-muted-foreground mt-2">On vous doit de l'argent</p>
              )}
              {myBalance < 0 && (
                <p className="text-sm text-muted-foreground mt-2">Vous devez de l'argent</p>
              )}
              {myBalance === 0 && (
                <p className="text-sm text-muted-foreground mt-2">Vous êtes à jour</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solde partenaire ({partnerData.name || partnerData.email})</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${partnerBalance >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {partnerBalance >= 0 ? "+" : ""}
                {partnerBalance.toFixed(2)} €
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
          <h2 className="text-lg sm:text-xl font-semibold">Dernières dépenses</h2>
          <div className="flex flex-wrap gap-2">
            <ApplyRecurringButton count={recurringCount} />
            {couple.expenses.length > 0 && (
              <ArchiveButton defaultLabel={getDefaultArchiveLabel()} />
            )}
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/expenses/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                Ajouter une dépense
              </Link>
            </Button>
          </div>
        </div>

        <ExpensesList
          expenses={couple.expenses}
          users={couple.users}
          currentUserId={currentUserData.id}
        />
      </main>

      <Button
        asChild
        size="lg"
        className="sm:hidden fixed bottom-5 right-5 h-14 w-14 rounded-full shadow-lg p-0 z-20"
        aria-label="Ajouter une dépense"
      >
        <Link href="/expenses/new">
          <PlusCircle className="!h-6 !w-6" />
        </Link>
      </Button>
    </div>
  )
}
