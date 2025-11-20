
CREATE OR REPLACE FUNCTION get_sentiment_stats(
  date_range_start timestamptz DEFAULT NULL,
  source_filter bigint DEFAULT NULL,
  search_term text DEFAULT NULL
)
RETURNS TABLE (
  overall float,
  positive bigint,
  negative bigint,
  neutral bigint,
  total_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  base_query text;
  where_clauses text[] := ARRAY[]::text[];
  final_query text;
BEGIN
  -- Base CTE for filtering articles
  base_query := '
    WITH filtered_articles AS (
      SELECT 
        a.id,
        s.final_score
      FROM articles a
      JOIN sentiment_scores s ON a.id = s.article_id
      WHERE 1=1
  ';

  -- Add filters
  IF date_range_start IS NOT NULL THEN
    base_query := base_query || ' AND a.published_at >= ' || quote_literal(date_range_start);
  END IF;

  IF source_filter IS NOT NULL THEN
    base_query := base_query || ' AND a.source_id = ' || source_filter;
  END IF;

  IF search_term IS NOT NULL AND search_term != '' THEN
    base_query := base_query || ' AND (
      a.headline ILIKE ' || quote_literal('%' || search_term || '%') || ' OR 
      a.summary ILIKE ' || quote_literal('%' || search_term || '%') || ' OR 
      a.content ILIKE ' || quote_literal('%' || search_term || '%')
    || ')';
  END IF;

  base_query := base_query || ') ';

  -- Calculate stats
  final_query := base_query || '
    SELECT
      COALESCE(AVG(final_score), 0)::float as overall,
      COUNT(*) FILTER (WHERE final_score > 0.2) as positive,
      COUNT(*) FILTER (WHERE final_score < -0.2) as negative,
      COUNT(*) FILTER (WHERE final_score BETWEEN -0.2 AND 0.2) as neutral,
      COUNT(*) as total_count
    FROM filtered_articles;
  ';

  RETURN QUERY EXECUTE final_query;
END;
$$;
