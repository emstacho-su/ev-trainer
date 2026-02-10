-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "oauthProvider" TEXT,
    "oauthProviderId" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "runtimeKey" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "userId" TEXT,
    "mode" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "decisionIndex" INTEGER NOT NULL DEFAULT 0,
    "decisionsPerSession" INTEGER NOT NULL DEFAULT 10,
    "currentSpot" JSONB,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "spotId" TEXT NOT NULL,
    "spot" JSONB NOT NULL,
    "actionId" TEXT NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "heroPosition" TEXT NOT NULL,
    "villainPosition" TEXT,
    "totalDecisions" INTEGER NOT NULL DEFAULT 0,
    "correctDecisions" INTEGER NOT NULL DEFAULT 0,
    "avgEvLoss" DECIMAL(10,4) NOT NULL,
    "lastPracticed" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalDecisions" INTEGER NOT NULL DEFAULT 0,
    "correctDecisions" INTEGER NOT NULL DEFAULT 0,
    "avgEvLoss" DECIMAL(10,4) NOT NULL,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_oauthProvider_oauthProviderId_key" ON "User"("oauthProvider", "oauthProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_runtimeKey_key" ON "Session"("runtimeKey");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_sessionId_seed_idx" ON "Session"("sessionId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionId_seed_key" ON "Session"("sessionId", "seed");

-- CreateIndex
CREATE INDEX "SessionEntry_sessionId_index_idx" ON "SessionEntry"("sessionId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEntry_sessionId_index_key" ON "SessionEntry"("sessionId", "index");

-- CreateIndex
CREATE INDEX "SpotStat_userId_spotId_idx" ON "SpotStat"("userId", "spotId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotStat_userId_spotId_key" ON "SpotStat"("userId", "spotId");

-- CreateIndex
CREATE INDEX "DailyStat_userId_date_idx" ON "DailyStat"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_userId_date_key" ON "DailyStat"("userId", "date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEntry" ADD CONSTRAINT "SessionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotStat" ADD CONSTRAINT "SpotStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
