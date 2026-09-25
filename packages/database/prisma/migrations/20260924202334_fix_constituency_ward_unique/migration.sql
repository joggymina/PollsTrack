/*
  Warnings:

  - A unique constraint covering the columns `[countyId,code]` on the table `Constituency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[constituencyId,code]` on the table `Ward` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Constituency_code_key";

-- DropIndex
DROP INDEX "Ward_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Constituency_countyId_code_key" ON "Constituency"("countyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_constituencyId_code_key" ON "Ward"("constituencyId", "code");
