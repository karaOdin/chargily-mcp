-- AlterTable
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_api_keys" ("createdAt", "expiresAt", "hashedKey", "id", "isActive", "key", "lastUsedAt", "name", "updatedAt", "userId") SELECT "createdAt", "expiresAt", "hashedKey", "id", "isActive", "key", "lastUsedAt", "name", "updatedAt", "userId" FROM "api_keys";
DROP TABLE "api_keys";
ALTER TABLE "new_api_keys" RENAME TO "api_keys";
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");
CREATE INDEX "api_keys_hashedKey_idx" ON "api_keys"("hashedKey");
CREATE INDEX "api_keys_isActive_idx" ON "api_keys"("isActive");
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");
CREATE TABLE "new_system_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_system_config" ("createdAt", "description", "id", "key", "updatedAt", "updatedBy", "value") SELECT "createdAt", "description", "id", "key", "updatedAt", "updatedBy", "value" FROM "system_config";
DROP TABLE "system_config";
ALTER TABLE "new_system_config" RENAME TO "system_config";
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
