// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Line, Bar } from 'react-chartjs-2';
import SentimentTrend from '@/components/SentimentTrend';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [articles, setArticles] = useState<any[]>([]);
  const [totalArticles, setTotalArticles] = useState<number>(0);
  const [sentimentStats, setSentimentStats] = useState<{
    positive: number;
    negative: number;
    neutral: number;
    analyzed: number;
  }>({ positive: 0, negative: 0, neutral: 0, analyzed: 0 });
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscription for articles
    const subscription = supabase
      .channel('articles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'articles' },
        () => {
          console.log('Articles table changed, refreshing...');
          fetchDashboardData();
        }
      )
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch total count of articles
      const { count: totalCount, error: countError } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      setTotalArticles(totalCount || 0);
      
      // Fetch total count of articles with sentiment scores
      const { count: sentimentCount, error: sentimentCountError } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('id', 
          (await supabase.from('sentiment_scores').select('article_id')).data?.map(s => s.article_id) || []
        );
      
      if (sentimentCountError) throw sentimentCountError;
      console.log('Articles with sentiment:', sentimentCount || 0);
      
      // Fetch sentiment summary
      console.log('Fetching sentiment scores...');
      const { data: sentimentSummary, error: summaryError } = await supabase
        .from('sentiment_scores')
        .select('final_score');
      
      if (summaryError) {
        console.error('Error fetching sentiment scores:', summaryError);
        throw summaryError;
      }
      
      console.log('Fetched sentiment scores:', sentimentSummary?.length || 0);
      
      // Calculate sentiment based on final_score since sentiment field is null
      const positiveCount = sentimentSummary?.filter(s => s.final_score > 0.2).length || 0;
      const negativeCount = sentimentSummary?.filter(s => s.final_score < -0.2).length || 0;
      const neutralCount = sentimentSummary?.filter(s => s.final_score >= -0.2 && s.final_score <= 0.2).length || 0;
      
      console.log('Sentiment breakdown:', {
        positive: positiveCount,
        negative: negativeCount,
        neutral: neutralCount,
        total: sentimentSummary?.length || 0
      });
      
      // Update sentiment stats state
      setSentimentStats({
        positive: positiveCount,
        negative: negativeCount,
        neutral: neutralCount,
        analyzed: sentimentSummary?.length || 0
      });
      
      // Fetch latest articles with sentiment (limit to 10 for display)
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select(`
          *,
          sentiment_scores (
            final_score
          ),
          sources (
            name
          )
        `)
        .order('published_at', { ascending: false })
        .limit(10);

      if (articlesError) throw articlesError;

      // Fetch sentiment trends
      const { data: trends, error: trendsError } = await supabase
        .from('sentiment_trends')
        .select('*')
        .order('time_period', { ascending: true });

      // Prepare chart data (handle empty or missing trends)
      if (trendsError) {
        console.warn('Could not fetch sentiment trends:', trendsError.message);
        // Set empty chart data
        setSentimentData({
          labels: [],
          datasets: [
            {
              label: 'Positive',
              data: [],
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
            },
            {
              label: 'Negative',
              data: [],
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
            {
              label: 'Neutral',
              data: [],
              borderColor: 'rgb(156, 163, 175)',
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
            },
          ],
        });
      } else if (trends?.length) {
        const labels = trends.map(t => 
          new Date(t.time_period).toLocaleDateString()
        );
        
        setSentimentData({
          labels,
          datasets: [
            {
              label: 'Average Sentiment',
              data: trends.map(t => t.avg_sentiment),
              borderColor: 'rgb(79, 70, 229)',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              tension: 0.3,
              fill: true
            }
          ]
        });
      }

      setArticles(articles || []);
      
      // Handle case where trends exist but are empty
      if (!trendsError && (!trends || trends.length === 0)) {
        setSentimentData({
          labels: [],
          datasets: [
            {
              label: 'Positive',
              data: [],
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
            },
            {
              label: 'Negative',
              data: [],
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
            },
            {
              label: 'Neutral',
              data: [],
              borderColor: 'rgb(156, 163, 175)',
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
            },
          ],
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      
      // Set default values on error
      setTotalArticles(0);
      setSentimentStats({
        positive: 0,
        negative: 0,
        neutral: 0,
        analyzed: 0
      });
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-md text-center">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">News Sentiment Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 mb-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Articles</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {totalArticles}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        ({articles.length} recent)
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          
          {/* Add more stat cards here */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Positive Sentiment</dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {sentimentStats.positive}
                      <span className="ml-1 text-sm font-normal text-gray-500">
                        ({sentimentStats.analyzed > 0 ? Math.round((sentimentStats.positive / sentimentStats.analyzed) * 100) : 0}% of {sentimentStats.analyzed} analyzed)
                      </span>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Info - Remove in production */}
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Debug Information</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Total Articles: {totalArticles}</p>
            <p>Articles with Sentiment Scores: {sentimentStats.analyzed}</p>
            <p>Positive (&gt;0.2): {sentimentStats.positive} ({sentimentStats.analyzed > 0 ? Math.round((sentimentStats.positive / sentimentStats.analyzed) * 100) : 0}%)</p>
            <p>Negative (&lt;-0.2): {sentimentStats.negative}</p>
            <p>Neutral (-0.2 to 0.2): {sentimentStats.neutral}</p>
            <p>Recent Articles Displayed: {articles.length}</p>
          </div>
        </div>

        {/* Sentiment Trend Section */}
        <div className="mb-8">
          <SentimentTrend />
        </div>

        {/* Other Charts Section */}
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
          {/* Sentiment Distribution */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Sentiment Distribution</h2>
            <div className="h-80 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-4">Sentiment distribution chart will be displayed here</p>
                <div className="w-64 h-4 bg-gray-200 rounded-full overflow-hidden mx-auto">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500"
                    style={{ width: '100%' }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>Negative</span>
                  <span>Neutral</span>
                  <span>Positive</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Articles */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Latest Articles</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Recently analyzed news articles with sentiment scores</p>
          </div>
          <div className="divide-y divide-gray-200">
            {articles.length > 0 ? (
              articles.map(article => (
                <div key={article.id} className="px-4 py-5 sm:px-6 hover:bg-gray-50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-indigo-600 truncate">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {article.headline}
                        </a>
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {article.sources?.name || 'Unknown Source'} • {new Date(article.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:ml-4">
                      <span 
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          article.sentiment_scores?.final_score > 0.2 ? 'bg-green-100 text-green-800' :
                          article.sentiment_scores?.final_score < -0.2 ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {article.sentiment_scores?.final_score ? (
                          <>
                            {article.sentiment_scores.final_score > 0.2 ? '😊 ' : 
                             article.sentiment_scores.final_score < -0.2 ? '😠 ' : '😐 '}
                            {article.sentiment_scores.final_score.toFixed(2)}
                          </>
                        ) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
                <p className="mt-1 text-sm text-gray-500">Start collecting articles to see them here.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}