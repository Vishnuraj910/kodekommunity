ALTER TYPE "ConversationType" ADD VALUE 'GROUP';

CREATE TYPE "ChannelVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

ALTER TABLE "Conversation"
ADD COLUMN "groupId" VARCHAR(64),
ADD COLUMN "slug" VARCHAR(80),
ADD COLUMN "description" VARCHAR(1000) NOT NULL DEFAULT '',
ADD COLUMN "visibility" "ChannelVisibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN "createdById" VARCHAR(64),
ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "Conversation_communityId_slug_key"
ON "Conversation"("communityId", "slug");

CREATE INDEX "Conversation_groupId_updatedAt_idx"
ON "Conversation"("groupId", "updatedAt");

CREATE INDEX "Conversation_communityId_visibility_deletedAt_idx"
ON "Conversation"("communityId", "visibility", "deletedAt");

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "Group"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
