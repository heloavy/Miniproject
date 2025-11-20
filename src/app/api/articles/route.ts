import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseClient } from '@/lib/supabase/client';

type SentimentStats = {
  overall: number;
  positive: number;
  negative: number;
  neutral: number;
};

type DateRange = '24h' | '7d' | '30d';

const RANGE_TO_DAYS: Record<DateRange, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

const STATS_RESULT_LIMIT = 10000;

const DEFAULT_SENTIMENT_STATS: SentimentStats = {
  overall: 0,
  positive: 0,
  negative: 0,
  neutral: 0,
};

function getRangeStart(range: DateRange) {
  const days = RANGE_TO_DAYS[range];
  if (!days) return null;

  const date = new Date();
  if (range === '24h') {
    date.setHours(date.getHours() - 24);
  } else {
    date.setDate(date.getDate() - days);
  }
  return date;
}

function escapeLikeTerm(term: string) {
  return term.replace(/[%_]/g, (match) => `\\${match}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateRange = (searchParams.get('dateRange') as DateRange) || '7d';
  const sourceParam = searchParams.get('source');
  const searchParam = searchParams.get('search') || '';
  const limitParam = Number(searchParams.get('limit') || '120');

  const limit = Math.min(Math.max(limitParam, 10), 400);
  const sourceFilter =
    sourceParam && sourceParam !== 'all' && !Number.isNaN(Number(sourceParam))
      ? Number(sourceParam)
      : null;
  const searchTerm = searchParam.trim();

  const rangeStart = getRangeStart(dateRange);
  const supabase = supabaseClient;

  let query = supabase
    .from('articles')
    .select(
      `
      id,
      headline,
      summary,
      content,
      published_at,
      source_id,
      url,
      country,
      sources(name),
      sentiment_scores(
        final_score,
        vader_compound,
        transformer_score
      )
    `
    )
    .order('published_at', { ascending: false })
    .limit(limit);

  if (rangeStart) {
    query = query.gte('published_at', rangeStart.toISOString());
  }

  if (sourceFilter) {
    query = query.eq('source_id', sourceFilter);
  }

  if (searchTerm) {
    const escaped = escapeLikeTerm(searchTerm);
    query = query.or(
      `headline.ilike.%${escaped}%,summary.ilike.%${escaped}%,content.ilike.%${escaped}%`
    );
  }

  const [articlesResult, sourcesResult] = await Promise.all([
    query,
    supabase.from('sources').select('id, name').order('name'),
  ]);

  const { data, error } = articlesResult;
  const { data: sourcesData, error: sourcesError } = sourcesResult;

  if (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (sourcesError) {
    console.error('Error fetching sources:', sourcesError);
  }

  const articles = (data || []).map((article: any) => ({
    id: String(article.id),
    headline: article.headline,
    sourceId: article.source_id !== null && article.source_id !== undefined ? String(article.source_id) : null,
    source: article.sources?.name ?? 'Unknown Source',
    publishedAt: article.published_at,
    sentimentScore:
      article.sentiment_scores?.final_score ?? null,
    sentimentLabel: null,
    sentimentConfidence: null,
    vaderScore: article.sentiment_scores?.vader_compound ?? null,
    transformerScore: article.sentiment_scores?.transformer_score ?? null,
    summary: article.summary,
    content: article.content,
    url: article.url,
    country: article.country,
  }));

  const availableSources = (sourcesData || []).map((source) => ({
    id: String(source.id),
    name: source.name ?? 'Unknown Source',
  }));

  // Use RPC for accurate stats calculation
  const { data: rpcStats, error: rpcError } = await supabase.rpc('get_sentiment_stats', {
    date_range_start: rangeStart ? rangeStart.toISOString() : null,
    source_filter: sourceFilter,
    search_term: searchTerm || null,
  });

  if (rpcError) {
    console.error('Error fetching sentiment stats via RPC:', rpcError);
  }

  let sentimentStats: SentimentStats = DEFAULT_SENTIMENT_STATS;

  if (rpcStats && rpcStats.length > 0) {
    const s = rpcStats[0];
    // The RPC returns overall as a float, and counts as strings/bigints (depending on driver)
    // We ensure they are numbers.
    sentimentStats = {
      overall: Number(s.overall) || 0,
      positive: Number(s.positive) || 0,
      negative: Number(s.negative) || 0,
      neutral: Number(s.neutral) || 0,
    };
  }

  return NextResponse.json({
    articles,
    meta: {
      count: articles.length,
      dateRange,
      sources: availableSources,
      sentimentStats,
    },
  });
}
