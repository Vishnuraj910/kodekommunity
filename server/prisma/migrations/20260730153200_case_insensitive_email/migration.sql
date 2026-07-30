-- Local and OIDC account linking must never create two identities that differ
-- only by email casing. Application writes are normalized as well.
CREATE UNIQUE INDEX "User_email_normalized_key"
ON "User" (lower("email"))
WHERE "email" IS NOT NULL;
