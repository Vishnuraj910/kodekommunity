ALTER TABLE "Conversation"
ADD COLUMN "directKey" CHAR(64);

CREATE UNIQUE INDEX "Conversation_directKey_key"
ON "Conversation"("directKey");
