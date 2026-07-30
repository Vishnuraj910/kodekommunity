-- DropIndex
DROP INDEX "Message_conversationId_createdAt_idx";

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Community_name_id_idx" ON "Community"("name", "id");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_id_idx" ON "Conversation"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "Event_startsAt_id_idx" ON "Event"("startsAt", "id");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "User_displayName_id_idx" ON "User"("displayName", "id");
