import { signIn } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignIn() {
  const isDev = process.env.NODE_ENV === "development"
  const devEmails = isDev
    ? (process.env.ALLOWED_EMAILS?.split(",")
        .map((e) => e.trim())
        .filter(Boolean) ?? [])
    : []

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>Connectez-vous avec votre compte Google autorisé</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server"
              await signIn("google", { redirectTo: "/" })
            }}
          >
            <Button type="submit" className="w-full">
              Se connecter avec Google
            </Button>
          </form>

          {isDev && devEmails.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <p className="text-xs text-muted-foreground">Dev login (NODE_ENV=development)</p>
              {devEmails.map((email) => (
                <form
                  key={email}
                  action={async () => {
                    "use server"
                    await signIn("dev", { email, redirectTo: "/" })
                  }}
                >
                  <Button type="submit" variant="outline" className="w-full">
                    Se connecter en tant que {email}
                  </Button>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
