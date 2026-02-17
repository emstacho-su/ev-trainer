-- AlterTable
ALTER TABLE "SessionEntry" ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SessionEntry_sessionId_isFlagged_idx" ON "SessionEntry"("sessionId", "isFlagged");
