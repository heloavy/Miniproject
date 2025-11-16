-- Add missing columns to sentiment_scores table
ALTER TABLE sentiment_scores
ADD COLUMN IF NOT EXISTS analysis_text TEXT,
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(50),
ADD COLUMN IF NOT EXISTS confidence FLOAT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows with default values
UPDATE sentiment_scores 
SET 
  analysis_text = '',
  sentiment = CASE 
    WHEN final_score > 0.1 THEN 'positive'
    WHEN final_score < -0.1 THEN 'negative'
    ELSE 'neutral'
  END,
  confidence = LEAST(1.0, ABS(COALESCE(final_score, 0)) * 1.5),
  created_at = COALESCE(analysis_date, NOW()),
  updated_at = NOW()
WHERE analysis_text IS NULL;

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sentiment_scores
DROP TRIGGER IF EXISTS update_sentiment_scores_modtime ON sentiment_scores;
CREATE TRIGGER update_sentiment_scores_modtime
BEFORE UPDATE ON sentiment_scores
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create an index on the sentiment column for faster filtering
CREATE INDEX IF NOT EXISTS idx_sentiment_scores_sentiment ON sentiment_scores(sentiment);
