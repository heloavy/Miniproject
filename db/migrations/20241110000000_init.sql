-- Create tables for AI News Sentiment Analyzer

-- Sources table
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    api_id TEXT,
    url TEXT,
    country TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- News table
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_source FOREIGN KEY(source_id) REFERENCES sources(id)
);

-- Sentiment analysis results
CREATE TABLE IF NOT EXISTS sentiment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    score_vader FLOAT,
    score_bert FLOAT,
    fused_score FLOAT GENERATED ALWAYS AS (COALESCE(score_vader * 0.6, 0) + COALESCE(score_bert * 0.4, 0)) STORED,
    details_json JSONB,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_news FOREIGN KEY(news_id) REFERENCES news(id)
);

-- Social reactions
CREATE TABLE IF NOT EXISTS social_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    reaction_count INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    sentiment_summary TEXT,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_news FOREIGN KEY(news_id) REFERENCES news(id)
);

-- RAG documents with vector embeddings
CREATE TABLE IF NOT EXISTS rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    embedding VECTOR(1536),  -- OpenAI embeddings dimension
    chunk_text TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_news FOREIGN KEY(news_id) REFERENCES news(id)
);

-- User queries and responses
CREATE TABLE IF NOT EXISTS user_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    response TEXT,
    model_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_news_source ON news(source_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at);
CREATE INDEX IF NOT EXISTS idx_sentiment_news ON sentiment(news_id);
CREATE INDEX IF NOT EXISTS idx_social_news ON social_reactions(news_id);
CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_documents USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_news ON rag_documents(news_id);

-- Enable vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
