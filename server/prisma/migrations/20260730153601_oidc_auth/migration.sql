-- CreateTable
CREATE TABLE "OidcIdentity" (
    "issuer" VARCHAR(500) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OidcIdentity_pkey" PRIMARY KEY ("issuer","subject")
);

-- CreateTable
CREATE TABLE "OidcFlow" (
    "stateHash" CHAR(64) NOT NULL,
    "codeVerifier" VARCHAR(128) NOT NULL,
    "nonce" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OidcFlow_pkey" PRIMARY KEY ("stateHash")
);

-- CreateIndex
CREATE INDEX "OidcIdentity_userId_idx" ON "OidcIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OidcIdentity_userId_issuer_key" ON "OidcIdentity"("userId", "issuer");

-- CreateIndex
CREATE INDEX "OidcFlow_expiresAt_idx" ON "OidcFlow"("expiresAt");

-- AddForeignKey
ALTER TABLE "OidcIdentity" ADD CONSTRAINT "OidcIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
