-- Drop the existing constraint if it exists
ALTER TABLE sentiment_scores DROP CONSTRAINT IF EXISTS sentiment_scores_article_id_fkey;

-- Drop the existing table if it exists
DROP TABLE IF EXISTS sentiment_scores CASCADE;

-- Recreate the table with the correct schema
CREATE TABLE sentiment_scores (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  vader_compound FLOAT,
  vader_positive FLOAT,
  vader_negative FLOAT,
  vader_neutral FLOAT,
  transformer_score FLOAT,
  final_score FLOAT,
  sentiment TEXT,
  confidence FLOAT,
  analysis_text TEXT,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sentiment_scores_article_id ON sentiment_scores(article_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_scores_sentiment ON sentiment_scores(sentiment);

-- Recreate the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_sentiment_scores_modtime ON sentiment_scores;
CREATE TRIGGER update_sentiment_scores_modtime
BEFORE UPDATE ON sentiment_scores
FOR EACH ROW EXECUTE FUNCTION update_modified_column();
