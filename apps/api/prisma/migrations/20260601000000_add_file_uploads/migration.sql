-- Add receiptUrl to fuel_logs for receipt photo upload
ALTER TABLE "fuel_logs" ADD COLUMN "receiptUrl" TEXT;

-- Add photoUrl to vehicle_maintenances for maintenance photo upload
ALTER TABLE "vehicle_maintenances" ADD COLUMN "photoUrl" TEXT;
