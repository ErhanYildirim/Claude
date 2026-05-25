-- Canvas Template Sistemi: esg_playground_graphs tablosuna şablon alanları ekle
ALTER TABLE esg_playground_graphs
  ADD COLUMN IF NOT EXISTS is_template       BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS template_key      TEXT     UNIQUE,
  ADD COLUMN IF NOT EXISTS template_category TEXT;

CREATE INDEX IF NOT EXISTS idx_esg_playground_graphs_is_template
  ON esg_playground_graphs(is_template) WHERE is_template = TRUE;
