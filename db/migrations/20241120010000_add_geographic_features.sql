-- Migration: Add geographic data tracking to articles
-- This enables better geographic sentiment analysis

-- 1. Add country column to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- 2. Create geographic_sentiment_summary table for aggregated stats
CREATE TABLE IF NOT EXISTS geographic_sentiment_summary (
  id SERIAL PRIMARY KEY,
  country VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  date DATE NOT NULL,
  article_count INTEGER DEFAULT 0,
  avg_sentiment FLOAT DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country, region, date)
);

-- 3. Create index for faster geographic queries
CREATE INDEX IF NOT EXISTS idx_articles_country ON articles(country);
CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region);
CREATE INDEX IF NOT EXISTS idx_geo_summary_country_date ON geographic_sentiment_summary(country, date);

-- 4. Create function to extract country from article content or source
CREATE OR REPLACE FUNCTION extract_country_from_article(article_text TEXT, source_name TEXT)
RETURNS VARCHAR(100) AS $$
DECLARE
  detected_country VARCHAR(100);
  countries TEXT[] := ARRAY[
    'United States', 'China', 'India', 'United Kingdom', 'Germany', 
    'France', 'Japan', 'Canada', 'Australia', 'Brazil', 'Russia',
    'South Korea', 'Italy', 'Spain', 'Mexico', 'Indonesia', 'Turkey',
    'Saudi Arabia', 'Switzerland', 'Netherlands', 'Singapore', 'Israel',
    'UAE', 'Sweden', 'Poland', 'Belgium', 'Norway', 'Austria', 'Denmark',
    'Finland', 'Ireland', 'New Zealand', 'Portugal', 'Greece', 'Czech Republic'
  ];
  country TEXT;
BEGIN
  -- Check article text for country mentions
  FOREACH country IN ARRAY countries LOOP
    IF article_text ILIKE '%' || country || '%' THEN
      RETURN country;
    END IF;
  END LOOP;
  
  -- Default based on source
  IF source_name ILIKE '%bbc%' OR source_name ILIKE '%guardian%' THEN
    RETURN 'United Kingdom';
  ELSIF source_name ILIKE '%cnn%' OR source_name ILIKE '%nyt%' OR source_name ILIKE '%washington%' THEN
    RETURN 'United States';
  ELSIF source_name ILIKE '%reuters%' THEN
    RETURN 'Global';
  END IF;
  
  RETURN 'Global';
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to update geographic sentiment summary
CREATE OR REPLACE FUNCTION update_geographic_sentiment_summary()
RETURNS VOID AS $$
BEGIN
  INSERT INTO geographic_sentiment_summary (country, region, date, article_count, avg_sentiment, positive_count, negative_count, neutral_count)
  SELECT 
    COALESCE(a.country, 'Global') as country,
    a.region,
    DATE(a.published_at) as date,
    COUNT(*) as article_count,
    AVG(s.final_score) as avg_sentiment,
    COUNT(*) FILTER (WHERE s.final_score > 0.2) as positive_count,
    COUNT(*) FILTER (WHERE s.final_score < -0.2) as negative_count,
    COUNT(*) FILTER (WHERE s.final_score BETWEEN -0.2 AND 0.2) as neutral_count
  FROM articles a
  LEFT JOIN sentiment_scores s ON a.id = s.article_id
  WHERE a.published_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY COALESCE(a.country, 'Global'), a.region, DATE(a.published_at)
  ON CONFLICT (country, region, date) 
  DO UPDATE SET
    article_count = EXCLUDED.article_count,
    avg_sentiment = EXCLUDED.avg_sentiment,
    positive_count = EXCLUDED.positive_count,
    negative_count = EXCLUDED.negative_count,
    neutral_count = EXCLUDED.neutral_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Backfill country data for existing articles
UPDATE articles a
SET country = extract_country_from_article(
  COALESCE(a.headline, '') || ' ' || COALESCE(a.content, ''),
  COALESCE(s.name, '')
)
FROM sources s
WHERE a.source_id = s.id
  AND a.country IS NULL;

-- 7. Create trigger to auto-detect country on new articles
CREATE OR REPLACE FUNCTION auto_detect_country()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.country IS NULL THEN
    NEW.country := extract_country_from_article(
      COALESCE(NEW.headline, '') || ' ' || COALESCE(NEW.content, ''),
      (SELECT name FROM sources WHERE id = NEW.source_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_detect_country ON articles;
CREATE TRIGGER trigger_auto_detect_country
BEFORE INSERT OR UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION auto_detect_country();

-- 8. Initial summary population
SELECT update_geographic_sentiment_summary();

-- Verify the changes
SELECT 
  country,
  COUNT(*) as article_count,
  ROUND(AVG(s.final_score)::numeric, 3) as avg_sentiment
FROM articles a
LEFT JOIN sentiment_scores s ON a.id = s.article_id
WHERE a.country IS NOT NULL
GROUP BY country
ORDER BY article_count DESC
LIMIT 20;
