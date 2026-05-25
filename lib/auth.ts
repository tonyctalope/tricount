import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim()) || []
const isDev = process.env.NODE_ENV === "development"

export const { handlers, auth, signIn } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(isDev
      ? [
          Credentials({
            id: "dev",
            name: "Dev login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email = typeof credentials?.email === "string" ? credentials.email.trim() : ""
              if (!email || !allowedEmails.includes(email)) return null

              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: {
                  email,
                  name: email.split("@")[0],
                },
              })

              return { id: user.id, email: user.email, name: user.name }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email || !allowedEmails.includes(user.email)) {
        return false
      }
      return true
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id
      }

      if (token.sub && !token.coupleId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
        })

        if (dbUser) {
          if (!dbUser.coupleId) {
            const allCouples = await prisma.couple.findMany({
              include: { users: true },
              orderBy: { createdAt: "desc" },
            })

            const coupleWithOneUser = allCouples.find((c) => c.users.length === 1)

            if (coupleWithOneUser) {
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { coupleId: coupleWithOneUser.id },
              })
              token.coupleId = coupleWithOneUser.id
            } else {
              const newCouple = await prisma.couple.create({
                data: { label: "Notre couple" },
              })
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { coupleId: newCouple.id },
              })
              token.coupleId = newCouple.id
            }
          } else {
            token.coupleId = dbUser.coupleId
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.coupleId = (token.coupleId as string | null | undefined) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
})
