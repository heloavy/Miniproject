-- Create a function to remove duplicate articles
CREATE OR REPLACE FUNCTION remove_duplicate_articles()
RETURNS void AS $$
BEGIN
    -- Create a temporary table with the IDs to keep (newest article for each url/headline)
    CREATE TEMPORARY TABLE articles_to_keep AS
    SELECT DISTINCT ON (url, headline) id
    FROM articles
    ORDER BY url, headline, published_at DESC;
    
    -- Delete sentiment scores for articles that will be deleted
    DELETE FROM sentiment_scores
    WHERE article_id IN (
        SELECT id FROM articles
        WHERE id NOT IN (SELECT id FROM articles_to_keep)
    );
    
    -- Delete the duplicate articles
    DELETE FROM articles
    WHERE id NOT IN (SELECT id FROM articles_to_keep);
    
    -- Drop the temporary table
    DROP TABLE articles_to_keep;
    
    RAISE NOTICE 'Duplicate articles removed successfully';
END;
$$ LANGUAGE plpgsql;

-- Run the function
SELECT remove_duplicate_articles();

-- Check the final count
SELECT COUNT(*) as total_articles FROM articles;
