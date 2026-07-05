-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "expeditionsPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackFeature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyTrackId" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "danceability" DOUBLE PRECISION NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "valence" DOUBLE PRECISION NOT NULL,
    "acousticness" DOUBLE PRECISION NOT NULL,
    "instrumentalness" DOUBLE PRECISION NOT NULL,
    "tempo" DOUBLE PRECISION NOT NULL,
    "mode" INTEGER NOT NULL,
    "key" INTEGER NOT NULL,
    "genres" TEXT[],
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "territoryId" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "centroidVector" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "retreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "spotifyPlaylistId" TEXT NOT NULL,
    "trackIds" TEXT[],
    "status" TEXT NOT NULL,
    "completionRate" DOUBLE PRECISION,
    "skipRate" DOUBLE PRECISION,
    "saveCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerritoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_spotifyId_key" ON "User"("spotifyId");

-- CreateIndex
CREATE INDEX "TrackFeature_userId_idx" ON "TrackFeature"("userId");

-- CreateIndex
CREATE INDEX "TrackFeature_territoryId_idx" ON "TrackFeature"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackFeature_userId_spotifyTrackId_key" ON "TrackFeature"("userId", "spotifyTrackId");

-- CreateIndex
CREATE INDEX "Territory_userId_idx" ON "Territory"("userId");

-- CreateIndex
CREATE INDEX "Territory_userId_status_idx" ON "Territory"("userId", "status");

-- CreateIndex
CREATE INDEX "Expedition_userId_idx" ON "Expedition"("userId");

-- CreateIndex
CREATE INDEX "Expedition_userId_status_idx" ON "Expedition"("userId", "status");

-- CreateIndex
CREATE INDEX "TerritoryEvent_userId_idx" ON "TerritoryEvent"("userId");

-- CreateIndex
CREATE INDEX "TerritoryEvent_userId_createdAt_idx" ON "TerritoryEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrackFeature" ADD CONSTRAINT "TrackFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackFeature" ADD CONSTRAINT "TrackFeature_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expedition" ADD CONSTRAINT "Expedition_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryEvent" ADD CONSTRAINT "TerritoryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryEvent" ADD CONSTRAINT "TerritoryEvent_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
