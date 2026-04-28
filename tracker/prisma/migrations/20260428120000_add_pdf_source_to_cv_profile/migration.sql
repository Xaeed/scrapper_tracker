-- AlterTable: store original uploaded PDF alongside the generated HTML CV
ALTER TABLE "CvProfile" ADD COLUMN "pdfName" TEXT;
ALTER TABLE "CvProfile" ADD COLUMN "pdfData" TEXT;
