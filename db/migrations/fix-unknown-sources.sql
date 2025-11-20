-- Update all articles with NULL source_id to point to the NewsAPI source
-- First, get the NewsAPI source ID
DO $$
DECLARE
  newsapi_source_id INTEGER;
BEGIN
  -- Get the ID of the NewsAPI source
  SELECT id INTO newsapi_source_id
  FROM sources
  WHERE source_id = 'newsapi'
  LIMIT 1;

  -- If NewsAPI source doesn't exist, create it
  IF newsapi_source_id IS NULL THEN
    INSERT INTO sources (source_id, name, description, url, category, language, country)
    VALUES ('newsapi', 'NewsAPI', 'NewsAPI.org - Global News API', 'https://newsapi.org', 'general', 'en', 'us')
    RETURNING id INTO newsapi_source_id;
    
    RAISE NOTICE 'Created NewsAPI source with ID: %', newsapi_source_id;
  END IF;

  -- Update all articles with NULL source_id to use NewsAPI
  UPDATE articles
  SET source_id = newsapi_source_id
  WHERE source_id IS NULL;

  RAISE NOTICE 'Updated % articles to use NewsAPI source', (SELECT COUNT(*) FROM articles WHERE source_id = newsapi_source_id);
END $$;

-- Verify the update
SELECT 
  s.name as source_name,
  COUNT(a.id) as article_count
FROM articles a
LEFT JOIN sources s ON a.source_id = s.id
GROUP BY s.name
ORDER BY article_count DESC;
