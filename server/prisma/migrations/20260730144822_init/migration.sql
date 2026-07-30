-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ROOT', 'MAINTAINER', 'SUPER_ADMIN', 'ADMIN', 'PRESENTER', 'USER');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'COMMUNITY', 'EVENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'NOT_GOING');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('COMMUNITY', 'DIRECT', 'EVENT');

-- CreateEnum
CREATE TYPE "AvatarTone" AS ENUM ('INK', 'BLUE', 'CORAL', 'ORANGE', 'PLUM', 'SAGE', 'VIOLET');

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(64) NOT NULL,
    "handle" VARCHAR(32) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "initials" VARCHAR(8) NOT NULL,
    "avatarTone" "AvatarTone" NOT NULL DEFAULT 'INK',
    "email" VARCHAR(320),
    "status" "IdentityStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "visibility" "CommunityVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "communityId" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("communityId","userId")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "role" "RoleName" NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "communityId" VARCHAR(64),
    "eventId" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" VARCHAR(64) NOT NULL,
    "communityId" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(240) NOT NULL,
    "createdById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "eventId" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" VARCHAR(64) NOT NULL,
    "communityId" VARCHAR(64) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "type" "ConversationType" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" VARCHAR(64) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMPTZ(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" VARCHAR(64) NOT NULL,
    "conversationId" VARCHAR(64) NOT NULL,
    "authorId" VARCHAR(64) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" VARCHAR(64) NOT NULL,
    "actorUserId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" VARCHAR(64) NOT NULL,
    "communityId" VARCHAR(64),
    "eventId" VARCHAR(64),
    "idempotencyKey" VARCHAR(128),
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" VARCHAR(64) NOT NULL,
    "actorUserId" VARCHAR(64) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_status_idx" ON "CommunityMember"("userId", "status");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_scope_idx" ON "RoleAssignment"("userId", "scope");

-- CreateIndex
CREATE INDEX "RoleAssignment_communityId_role_idx" ON "RoleAssignment"("communityId", "role");

-- CreateIndex
CREATE INDEX "RoleAssignment_eventId_role_idx" ON "RoleAssignment"("eventId", "role");

-- A role's scope and foreign keys must agree even when data is written outside
-- Prisma. This closes the nullable-column gap that a normal unique constraint
-- cannot express.
ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_valid_scope_check"
CHECK (
  (
    "scope" = 'PLATFORM'
    AND "role" IN ('ROOT', 'MAINTAINER', 'USER')
    AND "communityId" IS NULL
    AND "eventId" IS NULL
  )
  OR
  (
    "scope" = 'COMMUNITY'
    AND "role" IN ('SUPER_ADMIN', 'ADMIN')
    AND "communityId" IS NOT NULL
    AND "eventId" IS NULL
  )
  OR
  (
    "scope" = 'EVENT'
    AND "role" = 'PRESENTER'
    AND "communityId" IS NULL
    AND "eventId" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "RoleAssignment_platform_unique"
ON "RoleAssignment" ("userId", "role")
WHERE "scope" = 'PLATFORM';

CREATE UNIQUE INDEX "RoleAssignment_community_unique"
ON "RoleAssignment" ("userId", "role", "communityId")
WHERE "scope" = 'COMMUNITY';

CREATE UNIQUE INDEX "RoleAssignment_event_unique"
ON "RoleAssignment" ("userId", "role", "eventId")
WHERE "scope" = 'EVENT';

-- CreateIndex
CREATE INDEX "Event_communityId_startsAt_idx" ON "Event"("communityId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_communityId_slug_key" ON "Event"("communityId", "slug");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_valid_time_range_check"
CHECK ("endsAt" > "startsAt");

-- CreateIndex
CREATE INDEX "EventRsvp_userId_updatedAt_idx" ON "EventRsvp"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_communityId_updatedAt_idx" ON "Conversation"("communityId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_joinedAt_idx" ON "ConversationParticipant"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_authorId_createdAt_idx" ON "Message"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_communityId_createdAt_idx" ON "AuditLog"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorUserId_key_action_key" ON "IdempotencyRecord"("actorUserId", "key", "action");

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
