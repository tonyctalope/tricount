-- AlterTable
ALTER TABLE "Archive" ADD COLUMN     "prorataSnapshot" JSONB;

-- Backfill: fige les archives existantes sur les prorata actuels du couple,
-- ce qui correspond aux soldes affichés jusqu'ici.
UPDATE "Archive" a
SET "prorataSnapshot" = (
    SELECT jsonb_object_agg(u."id", u."prorataPct")
    FROM "User" u
    WHERE u."coupleId" = a."coupleId"
)
WHERE EXISTS (
    SELECT 1 FROM "User" u WHERE u."coupleId" = a."coupleId"
);
