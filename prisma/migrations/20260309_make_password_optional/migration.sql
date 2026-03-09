-- AlterTable: make user password optional for OAuth/SSO users
ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL;
