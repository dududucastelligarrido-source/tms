-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "adiantamento" DECIMAL(10,2),
ADD COLUMN     "arrivalTime" TIMESTAMP(3),
ADD COLUMN     "cartaFrete" DECIMAL(10,2),
ADD COLUMN     "departureTime" TIMESTAMP(3),
ADD COLUMN     "pesoCarga" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "fuel_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "fuelType" TEXT NOT NULL,
    "liters" DECIMAL(10,3) NOT NULL,
    "pricePerLiter" DECIMAL(10,4) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "station" TEXT,
    "kmAtFueling" INTEGER NOT NULL,
    "kmPerLiter" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fuel_logs_tenantId_idx" ON "fuel_logs"("tenantId");

-- CreateIndex
CREATE INDEX "fuel_logs_tenantId_vehicleId_idx" ON "fuel_logs"("tenantId", "vehicleId");

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
