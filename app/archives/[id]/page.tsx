import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { calculateBalances } from "@/lib/balance"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExpensesList } from "@/components/expenses-list"
import { DeleteArchiveButton } from "@/components/delete-archive-button"

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/signin")
  }

  if (!user.coupleId) {
    redirect("/")
  }

  const couple = await prisma.couple.findUnique({
    where: { id: user.coupleId },
    include: { users: true },
  })

  if (!couple || couple.users.length < 2) {
    redirect("/")
  }

  const archive = await prisma.archive.findFirst({
    where: { id, coupleId: user.coupleId },
    include: {
      expenses: {
        include: { payer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!archive) {
    redirect("/archives")
  }

  const [user1, user2] = couple.users
  const currentUserData = couple.users.find((u) => u.email === user.email)!
  const partnerData = couple.users.find((u) => u.email !== user.email)!

  const { balance1, balance2 } = calculateBalances(archive.expenses, user1, user2)
  const myBalance = currentUserData.id === user1.id ? balance1 : balance2
  const partnerBalance = currentUserData.id === user1.id ? balance2 : balance1

  const expenses = archive.expenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
  }))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/archives" aria-label="Retour aux archives">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Archives</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-base sm:text-2xl font-bold truncate">{archive.label}</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
              Archivée le{" "}
              {new Date(archive.archivedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <DeleteArchiveButton id={archive.id} label={archive.label} />
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
                className={`text-3xl font-bold ${
                  myBalance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {myBalance >= 0 ? "+" : ""}
                {myBalance.toFixed(2)} €
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solde partenaire ({partnerData.name || partnerData.email})</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${
                  partnerBalance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {partnerBalance >= 0 ? "+" : ""}
                {partnerBalance.toFixed(2)} €
              </p>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-lg sm:text-xl font-semibold mb-4">Dépenses de la période</h2>
        <ExpensesList
          expenses={expenses}
          users={couple.users}
          currentUserId={currentUserData.id}
          readOnly
        />
      </main>
    </div>
  )
}
