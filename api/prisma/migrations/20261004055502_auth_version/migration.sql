-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "auth_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_version" INTEGER NOT NULL DEFAULT 0;
