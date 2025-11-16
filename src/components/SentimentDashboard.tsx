'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Article = {
  id: string;
  title: string;
  sentiment_score: number | null;
  sentiment_label: string | null;
  sentiment_confidence: number | null;
  published_at: string;
  source: string;
};

type SentimentStats = {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
};

export default function SentimentDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<SentimentStats>({ total: 0, positive: 0, negative: 0, neutral: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchArticles();
    setupRealtime();
  }, []);

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const { data } = await supabase
        .from('articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(50);
      
      if (data) {
        setArticles(data);
        updateStats(data);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('articles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles' },
        () => fetchArticles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateStats = (data: Article[]) => {
    const total = data.length;
    if (total === 0) return;

    const stats = data.reduce(
      (acc, { sentiment_label }) => {
        if (sentiment_label === 'positive') acc.positive++;
        else if (sentiment_label === 'negative') acc.negative++;
        else acc.neutral++;
        return acc;
      },
      { positive: 0, negative: 0, neutral: 0 }
    );

    setStats({
      total,
      positive: Math.round((stats.positive / total) * 100),
      negative: Math.round((stats.negative / total) * 100),
      neutral: Math.round((stats.neutral / total) * 100)
    });
  };

  const getSentimentColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-800';
    if (score > 0.3) return 'bg-green-100 text-green-800';
    if (score < -0.3) return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getSentimentLabel = (score: number | null) => {
    if (score === null) return 'Pending';
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">News Sentiment Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Positive" 
          value={`${stats.positive}%`} 
          color="text-green-600" 
          icon="👍"
        />
        <StatCard 
          title="Neutral" 
          value={`${stats.neutral}%`} 
          color="text-yellow-600" 
          icon="😐"
        />
        <StatCard 
          title="Negative" 
          value={`${stats.negative}%`} 
          color="text-red-600" 
          icon="👎"
        />
      </div>

      {/* Articles Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sentiment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {article.title}
                    </div>
                    <div className="text-sm text-gray-500">{article.source}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSentimentColor(article.sentiment_score)}`}
                    >
                      {getSentimentLabel(article.sentiment_score)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {article.sentiment_confidence ? 
                      `${Math.round(article.sentiment_confidence * 100)}%` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(article.published_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, icon }: { 
  title: string; 
  value: string; 
  color: string; 
  icon: string;
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center">
        <div className={`text-3xl mr-4 ${color}`}>{icon}</div>
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
