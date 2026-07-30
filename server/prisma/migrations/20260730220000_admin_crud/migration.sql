ALTER TABLE "Event"
ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE INDEX "Event_communityId_deletedAt_startsAt_idx"
ON "Event"("communityId", "deletedAt", "startsAt");
