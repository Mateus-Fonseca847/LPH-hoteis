-- Add editable payment observations for direct reservation requests.
ALTER TABLE "Reservation"
ADD COLUMN "paymentObservation1" TEXT,
ADD COLUMN "paymentObservation2" TEXT,
ADD COLUMN "paymentObservation3" TEXT;
