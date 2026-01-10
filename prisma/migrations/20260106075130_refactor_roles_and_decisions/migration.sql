/*
  Warnings:

  - You are about to drop the column `decision` on the `ApprovalDecision` table. All the data in the column will be lost.
  - The `status` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `actorRole` to the `ApprovalDecision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `ApprovalDecision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorRole` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "ApprovalDecision" DROP COLUMN "decision",
ADD COLUMN     "actorRole" "ActorRole" NOT NULL,
ADD COLUMN     "type" "ApprovalDecisionType" NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorRole" "ActorRole" NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "status",
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "Status";
