import { Expense, User } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"

export function calculateBalances(expenses: Expense[], user1: User, user2: User) {
  let balance1 = new Decimal(0)
  let balance2 = new Decimal(0)

  for (const expense of expenses) {
    const amount = new Decimal(expense.amount)
    const isPayer1 = expense.payerId === user1.id
    const prorataUser1 = user1.prorataPct
    const prorataUser2 = user2.prorataPct

    // Créditer le payeur
    if (isPayer1) {
      balance1 = balance1.plus(amount)
    } else {
      balance2 = balance2.plus(amount)
    }

    // Calculer les parts
    let share1: Decimal
    let share2: Decimal

    if (expense.prorata) {
      // Prorata mode - appliquer le prorata selon les participants
      if (expense.participants === "BOTH") {
        // Dépense partagée : chacun paie selon son prorata
        share1 = amount.times(prorataUser1).dividedBy(100)
        share2 = amount.times(prorataUser2).dividedBy(100)
      } else if (expense.participants === "PAYER_ONLY") {
        // Dépense personnelle du payeur : l'autre contribue selon son prorata
        if (isPayer1) {
          // User1 paie pour lui-même → User2 contribue selon son prorata (35%)
          share1 = amount.times(100 - prorataUser2).dividedBy(100)
          share2 = amount.times(prorataUser2).dividedBy(100)
        } else {
          // User2 paie pour lui-même → User1 contribue selon son prorata (65%)
          share1 = amount.times(prorataUser1).dividedBy(100)
          share2 = amount.times(100 - prorataUser1).dividedBy(100)
        }
      } else {
        // OTHER_ONLY - Dépense personnelle de l'autre : le bénéficiaire paie selon le prorata du payeur
        if (isPayer1) {
          // User1 paie pour User2 → User2 doit payer selon prorata de User1 (65%)
          share1 = amount.times(100 - prorataUser1).dividedBy(100)
          share2 = amount.times(prorataUser1).dividedBy(100)
        } else {
          // User2 paie pour User1 → User1 doit payer selon prorata de User2 (35%)
          share1 = amount.times(prorataUser2).dividedBy(100)
          share2 = amount.times(100 - prorataUser2).dividedBy(100)
        }
      }
    } else {
      // Non-prorata mode
      if (expense.participants === "BOTH") {
        share1 = amount.dividedBy(2)
        share2 = amount.dividedBy(2)
      } else if (expense.participants === "PAYER_ONLY") {
        if (isPayer1) {
          share1 = amount
          share2 = new Decimal(0)
        } else {
          share1 = new Decimal(0)
          share2 = amount
        }
      } else {
        // OTHER_ONLY
        if (isPayer1) {
          share1 = new Decimal(0)
          share2 = amount
        } else {
          share1 = amount
          share2 = new Decimal(0)
        }
      }
    }

    // Débiter les parts
    balance1 = balance1.minus(share1)
    balance2 = balance2.minus(share2)
  }

  return {
    balance1: balance1.toNumber(),
    balance2: balance2.toNumber(),
  }
}
