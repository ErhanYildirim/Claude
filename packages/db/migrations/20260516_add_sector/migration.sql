-- Installation.sector alanı ekleme
-- Mevcut kayıtlar için default: 'steel'
ALTER TABLE "installations" ADD COLUMN "sector" TEXT NOT NULL DEFAULT 'steel';
