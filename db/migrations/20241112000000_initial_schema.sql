-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS embeddings CASCADE;
DROP TABLE IF EXISTS article_keywords CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS sentiment_scores CASCADE;
DROP TABLE IF EXISTS social_media_reactions CASCADE;
DROP TABLE IF EXISTS sentiment_trends CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS collection_runs CASCADE;
DROP TABLE IF EXISTS sources CASCADE;

-- Create tables
CREATE TABLE sources (
  id SERIAL PRIMARY KEY,
  source_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(512),
  category VARCHAR(100),
  language VARCHAR(10),
  country VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE collection_runs (
  id SERIAL PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) NOT NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  articles_collected INTEGER DEFAULT 0,
  errors TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  external_id VARCHAR(1024) NOT NULL,
  headline TEXT NOT NULL,
  url VARCHAR(1024) NOT NULL,
  content TEXT,
  summary TEXT,
  author VARCHAR(255),
  image_url VARCHAR(1024),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_id, external_id)
);

CREATE TABLE sentiment_scores (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  vader_compound FLOAT,
  vader_positive FLOAT,
  vader_negative FLOAT,
  vader_neutral FLOAT,
  transformer_score FLOAT,
  final_score FLOAT,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id)
);

CREATE TABLE social_media_reactions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  post_id VARCHAR(255) NOT NULL,
  content TEXT,
  author_username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  sentiment_score FLOAT,
  UNIQUE(platform, post_id)
);

CREATE TABLE keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE article_keywords (
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  relevance FLOAT,
  PRIMARY KEY (article_id, keyword_id)
);

CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  embedding VECTOR(1536),
  model_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sentiment_trends (
  id SERIAL PRIMARY KEY,
  time_period TIMESTAMP WITH TIME ZONE NOT NULL,
  source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
  category VARCHAR(100),
  avg_sentiment FLOAT NOT NULL,
  article_count INTEGER NOT NULL,
  UNIQUE(time_period, source_id, category)
);

-- Create indexes
CREATE INDEX idx_articles_published ON articles(published_at);
CREATE INDEX idx_articles_source ON articles(source_id);
CREATE INDEX idx_sentiment_article ON sentiment_scores(article_id);
CREATE INDEX idx_social_article ON social_media_reactions(article_id);
CREATE INDEX idx_article_keywords_article ON article_keywords(article_id);
CREATE INDEX idx_article_keywords_keyword ON article_keywords(keyword_id);
CREATE INDEX idx_embeddings_article ON embeddings(article_id);
CREATE INDEX idx_chat_history_session ON chat_history(session_id);
CREATE INDEX idx_chat_history_created ON chat_history(created_at);
CREATE INDEX idx_sentiment_trends_period ON sentiment_trends(time_period);

-- Create GIN index for full-text search
CREATE INDEX idx_articles_fts ON articles USING GIN (to_tsvector('english', headline || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '')));

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_sources_modtime
BEFORE UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_articles_modtime
BEFORE UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Insert default source for NewsAPI
INSERT INTO sources (source_id, name, description, url, category, language, country)
VALUES ('newsapi', 'NewsAPI', 'NewsAPI.org - Global News API', 'https://newsapi.org', 'general', 'en', 'us')
ON CONFLICT (source_id) DO NOTHING;
