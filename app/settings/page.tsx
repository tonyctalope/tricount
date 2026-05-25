import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ProrataForm } from "@/components/prorata-form"

export default async function SettingsPage() {
  const user = await getCurrentUser()

  if (!user || !user.coupleId) {
    redirect("/auth/signin")
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      couple: {
        include: {
          users: true,
        },
      },
    },
  })

  if (!dbUser || !dbUser.couple) {
    redirect("/")
  }

  const partner = dbUser.couple.users.find((u) => u.id !== dbUser.id)

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
          <h1 className="text-base sm:text-lg font-semibold truncate">Paramètres</h1>
          <span className="w-16" aria-hidden />
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Pourcentage prorata</CardTitle>
            <CardDescription>Configurez votre pourcentage pour le mode prorata</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Quand le mode prorata est activé pour une dépense, celle-ci sera répartie selon
                  les pourcentages ci-dessous au lieu du 50/50 classique.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{dbUser.name || dbUser.email}</span>
                  <span className="font-semibold">{dbUser.prorataPct}%</span>
                </div>
                {partner && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{partner.name || partner.email}</span>
                    <span className="font-semibold">{partner.prorataPct}%</span>
                  </div>
                )}
              </div>

              <ProrataForm currentPct={dbUser.prorataPct} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
