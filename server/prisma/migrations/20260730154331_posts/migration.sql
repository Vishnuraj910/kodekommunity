-- CreateTable
CREATE TABLE "Post" (
    "id" VARCHAR(64) NOT NULL,
    "communityId" VARCHAR(64) NOT NULL,
    "groupId" VARCHAR(64),
    "authorId" VARCHAR(64) NOT NULL,
    "body" VARCHAR(10000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_communityId_createdAt_id_idx" ON "Post"("communityId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_groupId_createdAt_id_idx" ON "Post"("groupId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_communityId_deletedAt_createdAt_idx" ON "Post"("communityId", "deletedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
