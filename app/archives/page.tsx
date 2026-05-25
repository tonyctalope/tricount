import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Archive as ArchiveIcon } from "lucide-react"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { calculateBalances } from "@/lib/balance"
import { Decimal } from "@prisma/client/runtime/library"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function ArchivesPage() {
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

  const archives = await prisma.archive.findMany({
    where: { coupleId: user.coupleId },
    include: {
      expenses: {
        include: { payer: true },
      },
    },
    orderBy: { archivedAt: "desc" },
  })

  const [user1, user2] = couple.users
  const currentUserData = couple.users.find((u) => u.email === user.email)!

  const archivesWithStats = archives.map((archive) => {
    const total = archive.expenses.reduce(
      (acc, e) => acc.plus(new Decimal(e.amount)),
      new Decimal(0),
    )
    const { balance1, balance2 } = calculateBalances(archive.expenses, user1, user2)
    const myBalance = currentUserData.id === user1.id ? balance1 : balance2
    return {
      id: archive.id,
      label: archive.label,
      archivedAt: archive.archivedAt,
      count: archive.expenses.length,
      total: total.toNumber(),
      myBalance,
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold truncate">Archives</h1>
          <span className="w-16" aria-hidden />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        {archivesWithStats.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ArchiveIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucune archive pour le moment.</p>
              <p className="text-sm mt-2">
                Archivez la période courante depuis le tableau de bord pour commencer.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {archivesWithStats.map((archive) => (
              <Link key={archive.id} href={`/archives/${archive.id}`} className="block">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base sm:text-lg truncate">
                          {archive.label}
                        </CardTitle>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                          Archivée le{" "}
                          {new Date(archive.archivedAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-base sm:text-lg whitespace-nowrap">
                          {archive.total.toFixed(2)} €
                        </p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground">
                          {archive.count} dépense{archive.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <p
                      className={`text-xs sm:text-sm ${
                        archive.myBalance >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      Votre solde :{" "}
                      <span className="font-semibold">
                        {archive.myBalance >= 0 ? "+" : ""}
                        {archive.myBalance.toFixed(2)} €
                      </span>
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
