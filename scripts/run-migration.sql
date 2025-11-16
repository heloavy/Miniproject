-- Run the updated sentiment trend function
-- This will replace the existing function with the improved version

-- First, drop the existing function
DROP FUNCTION IF EXISTS get_sentiment_trend(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

-- Now create the improved function
CREATE OR REPLACE FUNCTION get_sentiment_trend(
  from_date TIMESTAMPTZ,
  to_date TIMESTAMPTZ,
  interval_type TEXT DEFAULT 'day'
)
RETURNS TABLE (
  date TIMESTAMPTZ,
  positive NUMERIC,
  negative NUMERIC,
  neutral NUMERIC,
  avg_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      date_trunc(interval_type, from_date),
      date_trunc(interval_type, to_date),
      CASE 
        WHEN interval_type = 'hour' THEN interval '1 hour'
        ELSE interval '1 day'
      END
    ) AS interval_start
  ),
  sentiment_data AS (
    SELECT
      date_trunc(interval_type, a.published_at) AS time_period,
      COUNT(*) FILTER (WHERE s.sentiment = 'positive') AS positive_count,
      COUNT(*) FILTER (WHERE s.sentiment = 'negative') AS negative_count,
      COUNT(*) FILTER (WHERE s.sentiment = 'neutral' OR s.sentiment IS NULL) AS neutral_count,
      AVG(s.final_score) AS avg_sentiment
    FROM
      articles a
    LEFT JOIN sentiment_scores s ON a.id = s.article_id
    WHERE
      a.published_at BETWEEN from_date AND to_date
      AND s.id IS NOT NULL  -- Only include articles that have sentiment analysis
    GROUP BY
      time_period
  )
  SELECT
    ds.interval_start AS date,
    COALESCE(
      ROUND(sd.positive_count::NUMERIC / NULLIF(
        (sd.positive_count + sd.negative_count + sd.neutral_count), 0
      ) * 100, 1),
      0
    ) AS positive,
    COALESCE(
      ROUND(sd.negative_count::NUMERIC / NULLIF(
        (sd.positive_count + sd.negative_count + sd.neutral_count), 0
      ) * 100, 1),
      0
    ) AS negative,
    COALESCE(
      ROUND(sd.neutral_count::NUMERIC / NULLIF(
        (sd.positive_count + sd.negative_count + sd.neutral_count), 0
      ) * 100, 1),
      0
    ) AS neutral,
    COALESCE(sd.avg_sentiment, 0) AS avg_score
  FROM
    date_series ds
  LEFT JOIN sentiment_data sd ON ds.interval_start = sd.time_period
  ORDER BY
    ds.interval_start;
END;
$$ LANGUAGE plpgsql;
