-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "archiveId" TEXT;

-- CreateTable
CREATE TABLE "Archive" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Archive_coupleId_idx" ON "Archive"("coupleId");

-- CreateIndex
CREATE INDEX "Expense_archiveId_idx" ON "Expense"("archiveId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Archive" ADD CONSTRAINT "Archive_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
