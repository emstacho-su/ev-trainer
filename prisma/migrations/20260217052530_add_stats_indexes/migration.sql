-- CreateIndex
CREATE INDEX "SpotStat_userId_lastPracticed_idx" ON "SpotStat"("userId", "lastPracticed");

-- CreateIndex
CREATE INDEX "SpotStat_userId_heroPosition_idx" ON "SpotStat"("userId", "heroPosition");
