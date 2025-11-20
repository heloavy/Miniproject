'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import SentimentTrend from '@/components/SentimentTrend';

type View = 'dashboard' | 'analytics' | 'watchlist' | 'alerts' | 'settings';

type Filters = {
  dateRange: '24h' | '7d' | '30d';
  source: string;
  sentiment: {
    positive: boolean;
    negative: boolean;
    neutral: boolean;
  };
  search: string;
};

type Article = {
  id: string;
  headline: string;
  sourceId?: string | null;
  source?: string;
  publishedAt?: string;
  sentimentScore?: number | null;
  sentimentLabel?: string | null;
  sentimentConfidence?: number | null;
  vaderScore?: number | null;
  transformerScore?: number | null;
  url?: string;
  summary?: string | null;
  entities?: string[];
  content?: string;
  sourceCountry?: string | null;
  country?: string | null;
};

type SentimentStats = {
  overall: number;
  positive: number;
  negative: number;
  neutral: number;
};

type WordStat = {
  word: string;
  count: number;
  sentimentSum: number;
  positive: number;
  negative: number;
  neutral: number;
};

type EntitySummary = {
  name: string;
  mentions: number;
  averageSentiment: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
};

type GeoSentiment = {
  country: string;
  count: number;
  average: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
};

type SourceStat = {
  source: string;
  count: number;
  averageSentiment: number;
};

type TopicStat = {
  name: string;
  count: number;
  averageSentiment: number;
};

const SOURCE_COUNTRY_OVERRIDES = new Map<string, string>([
  ['bbc news', 'United Kingdom'],
  ['cnn', 'United States'],
  ['reuters', 'Global'],
  ['bloomberg', 'United States'],
  ['techcrunch', 'United States'],
  ['guardian', 'United Kingdom'],
  ['cnbc', 'United States'],
  ['the wall street journal', 'United States'],
]);

const TOPIC_KEYWORDS: TopicStat[] = [
  { name: 'AI & Tech', count: 0, averageSentiment: 0 },
  { name: 'Climate & Energy', count: 0, averageSentiment: 0 },
  { name: 'Economy & Markets', count: 0, averageSentiment: 0 },
  { name: 'Policy & Politics', count: 0, averageSentiment: 0 },
  { name: 'Health & Science', count: 0, averageSentiment: 0 },
  { name: 'Geopolitics', count: 0, averageSentiment: 0 },
];

const TOPIC_KEYWORD_MAP: Record<string, string[]> = {
  'AI & Tech': ['ai', 'artificial intelligence', 'machine learning', 'automation', 'cloud', 'semiconductor', 'chip', 'deep learning', 'software', 'hardware'],
  'Climate & Energy': ['climate', 'emissions', 'energy', 'green', 'renewable', 'carbon', 'solar', 'wind', 'sustainability'],
  'Economy & Markets': ['economy', 'markets', 'finance', 'recession', 'bank', 'stocks', 'investor', 'inflation', 'trade'],
  'Policy & Politics': ['policy', 'government', 'election', 'regulation', 'law', 'senate', 'congress', 'bill', 'legislation'],
  'Health & Science': ['health', 'vaccine', 'medical', 'research', 'science', 'clinical', 'hospital'],
  'Geopolitics': ['geopolitic', 'border', 'war', 'military', 'defense', 'sanction', 'diplomatic'],
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'are', 'was', 'were', 'her', 'his', 'not', 'you',
  'are', 'but', 'all', 'our', 'your', 'just', 'new', 'news', 'about', 'they', 'their', 'them', 'also', 'been', 'more',
  'will', 'can', 'its', 'over', 'into', 'more', 'time', 'which', 'after', 'than', 'such', 'other', 'than', 'three',
]);

const normalizeToken = (token: string) => token.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

type SentimentCategory = 'positive' | 'negative' | 'neutral';

const getSentimentCategory = (score?: number | null): SentimentCategory => {
  if (score === null || score === undefined) return 'neutral';
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const buildWordStats = (articles: Article[]): WordStat[] => {
  const statsMap = new Map<string, WordStat>();

  articles.forEach((article) => {
    const sentiment = article.sentimentScore ?? 0;
    const category = getSentimentCategory(article.sentimentScore);
    const rawText = `${article.headline} ${article.summary ?? ''} ${article.content ?? ''}`;
    const matches = rawText.match(/\b[a-zA-Z0-9]{3,}\b/g);
    if (!matches) return;

    const seen = new Set<string>();
    matches.forEach((token) => {
      const normalized = normalizeToken(token);
      if (!normalized || normalized.length < 3 || STOP_WORDS.has(normalized)) return;
      if (seen.has(normalized)) return;
      seen.add(normalized);

      const existing = statsMap.get(normalized) ?? { word: normalized, count: 0, sentimentSum: 0, positive: 0, negative: 0, neutral: 0 };
      existing.count += 1;
      existing.sentimentSum += sentiment;
      existing[category] += 1;
      statsMap.set(normalized, existing);
    });
  });

  return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
};

const computeTopicInsights = (articles: Article[]): TopicStat[] => {
  const base = TOPIC_KEYWORDS.map((topic) => ({ ...topic }));

  articles.forEach((article) => {
    const text = `${article.headline} ${article.summary ?? ''} ${article.content ?? ''}`.toLowerCase();
    const sentiment = article.sentimentScore ?? 0;

    Object.entries(TOPIC_KEYWORD_MAP).forEach(([topic, keywords]) => {
      const managed = keywords.some((keyword) => text.includes(keyword));
      if (!managed) return;
      const entry = base.find((item) => item.name === topic);
      if (!entry) return;
      entry.count += 1;
      entry.averageSentiment += sentiment;
    });
  });

  return base.map((topic) => (topic.count > 0 ? {
    ...topic,
    averageSentiment: topic.averageSentiment / topic.count,
  } : topic));
};

const computeSourceStats = (articles: Article[]): SourceStat[] => {
  const map = new Map<string, SourceStat>();

  articles.forEach((article) => {
    const name = article.source || 'Unknown Source';
    const sentiment = article.sentimentScore ?? 0;
    const entry = map.get(name) ?? { source: name, count: 0, averageSentiment: 0 };
    entry.count += 1;
    entry.averageSentiment += sentiment;
    map.set(name, entry);
  });

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    averageSentiment: entry.count ? entry.averageSentiment / entry.count : 0,
  })).sort((a, b) => b.count - a.count);
};

const computeGeographicSentiment = (articles: Article[]): GeoSentiment[] => {
  const map = new Map<string, GeoSentiment>();

  articles.forEach((article) => {
    // Use the new country field from database, with fallback to old logic
    const country = article.country || article.sourceCountry || 'Global';
    const sentiment = article.sentimentScore ?? 0;
    const category = getSentimentCategory(article.sentimentScore);
    const entry = map.get(country) ?? {
      country,
      count: 0,
      average: 0,
      positivePercent: 0,
      negativePercent: 0,
      neutralPercent: 0,
    };
    entry.count += 1;
    entry.average += sentiment;
    if (category === 'positive') entry.positivePercent += 1;
    else if (category === 'negative') entry.negativePercent += 1;
    else entry.neutralPercent += 1;
    map.set(country, entry);
  });

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    average: entry.count ? entry.average / entry.count : 0,
    positivePercent: entry.count ? Math.round((entry.positivePercent / entry.count) * 100) : 0,
    negativePercent: entry.count ? Math.round((entry.negativePercent / entry.count) * 100) : 0,
    neutralPercent: entry.count ? Math.round((entry.neutralPercent / entry.count) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
};

type EntityInsight = {
  name: string;
  mentions: number;
  averageSentiment: number;
};

type SourceInsight = {
  name: string;
  count: number;
  averageSentiment: number;
};

type SourceOption = {
  id: string;
  name: string;
};

const SOURCE_ALL_OPTION: SourceOption = { id: 'all', name: 'All Sources' };

type ArticlesResponse = {
  articles: Article[];
  meta?: {
    count?: number;
    dateRange?: string;
    sources?: SourceOption[];
    sentimentStats?: SentimentStats;
  };
};

const DEFAULT_SENTIMENT_STATS: SentimentStats = {
  overall: 0,
  positive: 0,
  negative: 0,
  neutral: 0,
};

const getSentimentLabelFromScore = (score?: number | null) => {
  if (score === null || score === undefined) return 'Pending';
  if (score > 0.2) return 'Positive';
  if (score < -0.2) return 'Negative';
  return 'Neutral';
};

const getSentimentClassFromScore = (score?: number | null) => {
  if (score === null || score === undefined) return 'neutral';
  if (score > 0.2) return 'positive';
  if (score < -0.2) return 'negative';
  return 'neutral';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const getHeatmapClass = (score: number) => {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
};

const getTrendArrow = (value: number) => {
  if (value > 0) return '↗';
  if (value < 0) return '↘';
  return '→';
};

type WatchlistItem = {
  name: string;
  sentiment: number;
  alertEnabled: boolean;
};

type AlertItem = {
  id: string;
  entity: string;
  type: string;
  change: number;
  priority: 'emerging' | 'escalating' | 'critical';
  status: 'active' | 'resolved' | 'dismissed';
  timestamp: string;
};

type ToastMessage = {
  id: string;
  text: string;
};

type ChatRole = 'bot' | 'user';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
};

const VIEWS: View[] = ['dashboard', 'analytics', 'watchlist', 'alerts', 'settings'];

const ALERT_TYPES = [
  { value: 'spike', label: 'Sentiment Spike' },
  { value: 'emerging', label: 'Emerging Trend' },
  { value: 'volume', label: 'Volume Surge' },
  { value: 'sustained', label: 'Sustained Negative' },
];

const SUGGESTED_QUESTIONS = [
  'What is the sentiment about Tesla?',
  'Compare Apple vs Microsoft',
  "What's trending today?",
  'Show me recent tech news',
];

const INITIAL_FILTERS: Filters = {
  dateRange: '7d',
  source: 'all',
  sentiment: { positive: true, negative: true, neutral: true },
  search: '',
};

export default function DashboardShell() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [isArticlesLoading, setIsArticlesLoading] = useState(true);
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([SOURCE_ALL_OPTION]);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [sentimentStats, setSentimentStats] = useState<SentimentStats>(DEFAULT_SENTIMENT_STATS);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertItem[]>([]);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastQueue, setToastQueue] = useState<ToastMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'bot',
      text: "Hello! I'm your AI Sentiment Assistant. I can help you analyze sentiment data, find articles, compare entities, and identify trends. How can I assist you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(timeout);
  }, [filters.search]);

  useEffect(() => {
    const controller = new AbortController();

    const loadArticles = async () => {
      setIsArticlesLoading(true);
      setArticlesError(null);

      const params = new URLSearchParams({
        dateRange: filters.dateRange,
        limit: '120',
      });

      if (filters.source && filters.source !== SOURCE_ALL_OPTION.id) {
        params.set('source', filters.source);
      }

      const trimmedSearch = debouncedSearch.trim();
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }

      try {
        const response = await fetch(`/api/articles?${params.toString()}`, {
          signal: controller.signal,
        });

        let body: ArticlesResponse & { error?: string } = { articles: [] };
        try {
          body = (await response.json()) as ArticlesResponse & { error?: string };
        } catch (jsonError) {
          console.error('Failed to parse articles JSON', jsonError);
          throw new Error('Received invalid response from articles API.');
        }

        if (!response.ok) {
          throw new Error(body?.error || 'Unable to fetch articles');
        }

        if (controller.signal.aborted) return;

        setArticles(body.articles || []);

        const metaSources = body.meta?.sources ?? [];
        if (metaSources.length) {
          const unique = new Map<string, SourceOption>();
          unique.set(SOURCE_ALL_OPTION.id, SOURCE_ALL_OPTION);

          metaSources.forEach((source) => {
            if (!source?.id) return;
            const id = String(source.id);
            if (unique.has(id)) return;
            unique.set(id, {
              id,
              name: source.name || 'Unnamed Source',
            });
          });

          setSourceOptions(Array.from(unique.values()));
        } else {
          setSourceOptions([SOURCE_ALL_OPTION]);
        }

        if (body.meta?.sentimentStats) {
          setSentimentStats(body.meta.sentimentStats);
        } else {
          setSentimentStats(DEFAULT_SENTIMENT_STATS);
        }
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') {
          return;
        }

        console.error('Error fetching articles', error);
        setArticles([]);
        setSentimentStats(DEFAULT_SENTIMENT_STATS);
        setArticlesError(error instanceof Error ? error.message : 'Failed to load articles.');
      } finally {
        if (!controller.signal.aborted) {
          setIsArticlesLoading(false);
        }
      }
    };

    loadArticles();

    return () => controller.abort();
  }, [filters.dateRange, filters.source, debouncedSearch]);

  useEffect(() => {
    if (!sourceOptions.some((option) => option.id === filters.source)) {
      setFilters((prev) => ({ ...prev, source: SOURCE_ALL_OPTION.id }));
    }
  }, [sourceOptions, filters.source]);

  const filteredArticles = useMemo(() => {
    if (!articles.length) return [];

    const isSourceFiltered = filters.source !== SOURCE_ALL_OPTION.id;

    const matchesSentiment = (score: number | undefined | null) => {
      if (score === undefined || score === null) return filters.sentiment.neutral;
      if (score > 0.2) return filters.sentiment.positive;
      if (score < -0.2) return filters.sentiment.negative;
      return filters.sentiment.neutral;
    };

    return articles.filter((article) => {
      const fitsSentiment = matchesSentiment(article.sentimentScore ?? null);
      const fitsSearch = !filters.search
        || article.headline.toLowerCase().includes(filters.search.toLowerCase())
        || (article.entities || []).some((entity) =>
          entity.toLowerCase().includes(filters.search.toLowerCase())
        );
      const fitsSource = !isSourceFiltered || article.sourceId === filters.source;

      return fitsSentiment && fitsSearch && fitsSource;
    });
  }, [articles, filters]);

  const visibleArticles = useMemo(() => filteredArticles.slice(0, 25), [filteredArticles]);

  const sentimentDistribution = useMemo(() => {
    const total = sentimentStats.positive + sentimentStats.negative + sentimentStats.neutral;
    const createSegment = (label: string, value: number, color: string) => ({
      label,
      value,
      percent: total ? Math.round((value / total) * 100) : 0,
      color,
    });

    return [
      createSegment('Positive', sentimentStats.positive, '#16a34a'),
      createSegment('Negative', sentimentStats.negative, '#dc2626'),
      createSegment('Neutral', sentimentStats.neutral, '#f59e0b'),
    ];
  }, [sentimentStats]);

  const wordStats = useMemo(() => buildWordStats(filteredArticles), [filteredArticles]);
  const topicInsights = useMemo(() => computeTopicInsights(filteredArticles), [filteredArticles]);
  const sourceInsights = useMemo(() => computeSourceStats(filteredArticles), [filteredArticles]);
  const geographicInsights = useMemo(() => computeGeographicSentiment(filteredArticles), [filteredArticles]);
  const entityInsights = useMemo(() => {
    const map = new Map<string, { name: string; mentions: number; sentimentSum: number; positive: number; negative: number; neutral: number }>();

    // Common entities to look for if explicit entities are missing
    const COMMON_ENTITIES = [
      'Intel', 'Nvidia', 'AMD', 'Apple', 'Microsoft', 'Google', 'Tesla', 'Amazon', 'Meta', 'OpenAI',
      'Bitcoin', 'Ethereum', 'Crypto', 'AI', 'Fed', 'China', 'US', 'UK', 'EU', 'Samsung', 'TSMC',
      'Qualcomm', 'Arm', 'SoftBank', 'Binance', 'Coinbase', 'Ripple', 'Solana', 'Cardano', 'Polkadot'
    ];

    filteredArticles.forEach((article) => {
      let entities = article.entities || [];

      // Fallback: Extract common entities from headline/summary if no entities provided
      if (entities.length === 0) {
        const text = `${article.headline} ${article.summary || ''}`;
        entities = COMMON_ENTITIES.filter(e => text.includes(e));
      }

      entities.forEach((rawEntity) => {
        const key = rawEntity.toLowerCase();
        const entry = map.get(key) ?? { name: rawEntity, mentions: 0, sentimentSum: 0, positive: 0, negative: 0, neutral: 0 };
        entry.mentions += 1;
        entry.sentimentSum += article.sentimentScore ?? 0;
        const category = getSentimentCategory(article.sentimentScore);
        entry[category] += 1;
        map.set(key, entry);
      });
    });

    return Array.from(map.values())
      .map((entry) => ({
        name: capitalize(entry.name),
        mentions: entry.mentions,
        averageSentiment: entry.mentions ? entry.sentimentSum / entry.mentions : 0,
        positivePercent: entry.mentions ? Math.round((entry.positive / entry.mentions) * 100) : 0,
        negativePercent: entry.mentions ? Math.round((entry.negative / entry.mentions) * 100) : 0,
        neutralPercent: entry.mentions ? Math.round((entry.neutral / entry.mentions) * 100) : 0,
      }))
      .sort((a, b) => b.mentions - a.mentions);
  }, [filteredArticles]);

  const watchlistStats = useMemo(() => {
    const totalWatched = watchlist.length;
    const positiveTrend = watchlist.filter((item) => item.sentiment > 0.2).length;
    const negativeTrend = watchlist.filter((item) => item.sentiment < -0.2).length;

    return {
      totalWatched,
      positiveTrend,
      negativeTrend,
      activeAlerts: alerts.filter((alert) => alert.status === 'active').length,
    };
  }, [watchlist, alerts]);

  const showToast = (text: string) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    setToastQueue((prev) => [...prev, { id, text }]);

    setTimeout(() => {
      setToastQueue((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const handleWatchlistSubmit = () => {
    const value = watchlistInput.trim();
    if (!value) {
      showToast('Please enter an entity name.');
      return;
    }

    if (watchlist.some((item) => item.name.toLowerCase() === value.toLowerCase())) {
      showToast('Entity is already in your watchlist.');
      return;
    }

    setWatchlist((prev) => [
      ...prev,
      { name: value, sentiment: 0, alertEnabled: true },
    ]);

    setWatchlistInput('');
    showToast(`Added ${value} to watchlist.`);
  };

  const handleAlertCreation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entity = (data.get('alertEntity') || '').toString();
    const type = (data.get('alertType') || '').toString();
    const threshold = Number(data.get('alertThreshold') || 30);

    if (!entity) {
      showToast('Select an entity before saving an alert.');
      return;
    }

    const newAlert: AlertItem = {
      id: `${Date.now()}`,
      entity,
      type,
      change: threshold,
      priority: 'emerging',
      status: 'active',
      timestamp: new Date().toISOString(),
    };

    setAlerts((prev) => [newAlert, ...prev]);
    showToast(`Alert created for ${entity}.`);
    event.currentTarget.reset();
  };

  const handleAlertDismiss = (id: string) => {
    setAlerts((prev) => {
      const alert = prev.find((item) => item.id === id);
      if (!alert) return prev;

      setAlertHistory((history) => [{ ...alert, status: 'dismissed' }, ...history]);
      return prev.filter((item) => item.id !== id);
    });

    showToast('Alert dismissed.');
  };

  const handleWatchlistToggle = (name: string) => {
    setWatchlist((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, alertEnabled: !item.alertEnabled } : item
      )
    );
  };

  const handleWatchlistRemove = (name: string) => {
    setWatchlist((prev) => prev.filter((item) => item.name !== name));
    showToast(`Removed ${name} from watchlist.`);
  };

  const openArticleModal = (article: Article) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
  };

  const closeArticleModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  const toggleChatOpen = () => {
    setIsChatOpen((prev) => !prev);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  const clearChat = () => {
    setChatMessages([
      {
        id: 'welcome',
        role: 'bot',
        text: 'Chat cleared. How can I help you?',
        timestamp: new Date().toISOString(),
      },
    ]);
    setSuggestionsVisible(true);
    showToast('Chat history cleared');
  };

  const appendMessage = (message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const sendChatMessage = async (prefill?: string) => {
    const content = (prefill ?? chatInput).trim();
    if (!content) return;

    const userMsgId = `${Date.now()}-user`;
    appendMessage({
      id: userMsgId,
      role: 'user',
      text: content,
      timestamp: new Date().toISOString(),
    });
    setChatInput('');
    setSuggestionsVisible(false);
    setIsChatTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      appendMessage({
        id: `${Date.now()}-bot`,
        role: 'bot',
        text: data.response,
        timestamp: new Date().toISOString(),
        sentiment: data.sentiment as 'positive' | 'negative' | 'neutral',
      });
    } catch (error) {
      console.error('Chat error:', error);
      appendMessage({
        id: `${Date.now()}-error`,
        role: 'bot',
        text: 'Sorry, I encountered an error connecting to the AI service. Please try again.',
        timestamp: new Date().toISOString(),
        sentiment: 'negative',
      });
    } finally {
      setIsChatTyping(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendChatMessage(question);
  };

  const overviewCards = [
    { label: 'Overall Sentiment', value: sentimentStats.overall.toFixed(2), trend: '12.5%', sentimentClass: 'positive' },
    { label: 'Positive Articles', value: sentimentStats.positive, trend: '8.3%', sentimentClass: 'positive' },
    { label: 'Negative Articles', value: sentimentStats.negative, trend: '3.2%', sentimentClass: 'negative' },
    { label: 'Neutral Articles', value: sentimentStats.neutral, trend: '1.1%', sentimentClass: 'neutral' },
  ];

  const renderViewClass = (view: View) => `view ${currentView === view ? 'active' : ''}`;

  return (
    <div className="ni-app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">📊 AI-Driven News Sentiment Analyzer</h1>
            <div className="live-indicator">
              <span className="pulse-dot" />
              <span className="live-text">Live</span>
            </div>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              title="Toggle theme"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            >
              <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            </button>
            <div className="user-profile" aria-label="User profile">
              <span className="user-icon">👤</span>
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          {VIEWS.map((view) => (
            <button
              key={view}
              className={`nav-tab ${currentView === view ? 'active' : ''}`}
              onClick={() => setCurrentView(view)}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <div className="global-filters">
        <div className="filter-group">
          <label htmlFor="dateRangeFilter">Date Range:</label>
          <select
            id="dateRangeFilter"
            value={filters.dateRange}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: event.target.value as Filters['dateRange'],
              }))
            }
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sourceFilter">Source:</label>
          <select
            id="sourceFilter"
            value={filters.source}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                source: event.target.value,
              }))
            }
          >
            {sourceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Sentiment:</label>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={filters.sentiment.positive}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sentiment: { ...prev.sentiment, positive: event.target.checked },
                  }))
                }
              />
              {' '}Positive
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.sentiment.negative}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sentiment: { ...prev.sentiment, negative: event.target.checked },
                  }))
                }
              />
              {' '}Negative
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.sentiment.neutral}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sentiment: { ...prev.sentiment, neutral: event.target.checked },
                  }))
                }
              />
              {' '}Neutral
            </label>
          </div>
        </div>

        <div className="filter-group search-group">
          <input
            type="text"
            placeholder="Search keywords, entities..."
            value={filters.search}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                search: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <main className="main-content">
        <section id="dashboardView" className={renderViewClass('dashboard')}>
          <div className="overview-cards">
            {overviewCards.map((card) => (
              <div key={card.label} className="stat-card">
                <div className="stat-label">{card.label}</div>
                <div className="stat-value">{card.value}</div>
                <div className={`stat-trend ${card.sentimentClass}`}>
                  <span className="trend-arrow">{card.sentimentClass === 'negative' ? '↓' : card.sentimentClass === 'neutral' ? '→' : '↑'}</span>
                  <span className="trend-value">{card.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-grid">
            <div className="card full-width">
              <div className="card-header">
                <h3>Latest Sentiment Insights</h3>
                <div className="card-actions">
                  {isArticlesLoading && (
                    <span className="sentiment-badge neutral">Loading…</span>
                  )}
                  {articlesError && !isArticlesLoading && (
                    <span className="sentiment-badge negative" title={articlesError}>
                      Data error
                    </span>
                  )}
                </div>
              </div>
              <div className="card-body">
                {articlesError && (
                  <p className="placeholder-text" role="alert">{articlesError}</p>
                )}
                {visibleArticles.length === 0 && !isArticlesLoading ? (
                  <p className="placeholder-text">No articles match the current filters.</p>
                ) : (
                  <div className="table-container">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th>Headline</th>
                          <th>Fusion</th>
                          <th>VADER</th>
                          <th>DistilBERT</th>
                          <th>Published</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleArticles.map((article) => (
                          <tr
                            key={article.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openArticleModal(article)}
                          >
                            <td>
                              <div className="article-headline">
                                <strong>{article.headline}</strong>
                                <div className="article-source">
                                  {article.source || 'Unknown source'}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`sentiment-badge ${getSentimentClassFromScore(article.sentimentScore)}`}>
                                {article.sentimentScore?.toFixed(2) ?? 'N/A'}
                              </span>
                            </td>
                            <td>
                              {article.vaderScore !== null && article.vaderScore !== undefined
                                ? article.vaderScore.toFixed(2)
                                : 'N/A'}
                            </td>
                            <td>
                              {article.transformerScore !== null && article.transformerScore !== undefined
                                ? article.transformerScore.toFixed(2)
                                : 'N/A'}
                            </td>
                            <td>{formatDateTime(article.publishedAt)}</td>
                            <td>
                              <div className="button-group">
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openArticleModal(article);
                                  }}
                                >
                                  Details
                                </button>
                                {article.url && (
                                  <a
                                    className="btn btn-small btn-primary"
                                    href={article.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    Open Link
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card chart-card full-width">
              <div className="card-header">
                <h3>Real-Time Sentiment Trend</h3>
                <div className="card-actions">
                  <button className="btn-icon" title="Export">📥</button>
                  <button className="btn-icon" title="Fullscreen">⛶</button>
                </div>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  <SentimentTrend />
                </div>
              </div>
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <h3>🌍 Geographic Sentiment</h3>
                <div className="card-actions">
                  <span className="sentiment-badge neutral" style={{ fontSize: '0.85rem' }}>
                    {geographicInsights.length} {geographicInsights.length === 1 ? 'Region' : 'Regions'}
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="heatmap-container" id="geoHeatmap">
                  {geographicInsights.length === 0 ? (
                    <p className="placeholder-text">No geographic data available yet.</p>
                  ) : (
                    geographicInsights.slice(0, 12).map((country) => (
                      <div
                        key={country.country}
                        className={`heatmap-item ${getHeatmapClass(country.average)}`}
                        title={`${country.country}: ${country.count} articles, avg sentiment ${country.average.toFixed(2)}`}
                        style={{
                          borderLeft: `4px solid ${country.average > 0.1 ? '#16a34a' :
                            country.average < -0.1 ? '#dc2626' : '#f59e0b'
                            }`
                        }}
                      >
                        <div className="country-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div className="country-name" style={{ fontSize: '1rem', fontWeight: '600' }}>
                            {country.country}
                          </div>
                          <div className="country-sentiment" style={{
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            color: country.average > 0.1 ? '#16a34a' : country.average < -0.1 ? '#dc2626' : '#f59e0b'
                          }}>
                            {getTrendArrow(country.average)} {country.average.toFixed(2)}
                          </div>
                        </div>
                        <div className="entity-stats" style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                          📰 {country.count} articles
                        </div>
                        <div className="sentiment-breakdown" style={{
                          display: 'flex',
                          gap: '0.5rem',
                          marginTop: '0.5rem',
                          fontSize: '0.8rem'
                        }}>
                          <span style={{ color: '#16a34a' }}>✓ {country.positivePercent}%</span>
                          <span style={{ color: '#dc2626' }}>✗ {country.negativePercent}%</span>
                          <span style={{ color: '#f59e0b' }}>− {country.neutralPercent}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Top Trending Entities</h3>
              </div>
              <div className="card-body">
                <div className="entity-list" id="topEntitiesList">
                  {entityInsights.length === 0 ? (
                    <p className="placeholder-text">Entities will appear here.</p>
                  ) : (
                    entityInsights.slice(0, 6).map((entity) => (
                      <div key={entity.name} className="entity-item">
                        <div className="entity-info">
                          <div className="entity-name">{entity.name}</div>
                          <div className="entity-stats">
                            {entity.mentions} mentions · {entity.averageSentiment.toFixed(2)} avg
                          </div>
                        </div>
                        <div className={`entity-sentiment ${getHeatmapClass(entity.averageSentiment)}`}>
                          {getTrendArrow(entity.averageSentiment)} {entity.averageSentiment.toFixed(2)}
                        </div>
                        <div className="entity-trend">
                          {entity.positivePercent}% / {entity.negativePercent}% / {entity.neutralPercent}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="analyticsView" className={renderViewClass('analytics')}>
          <div className="analytics-grid">
            <div className="card chart-card">
              <div className="card-header">
                <h3>Sentiment Distribution</h3>
              </div>
              <div className="card-body">
                <div className="sentiment-distribution">
                  {sentimentDistribution.map((segment) => (
                    <div className="sentiment-segment" key={segment.label}>
                      <div className="segment-header">
                        <span>{segment.label}</span>
                        <span>{segment.percent}%</span>
                      </div>
                      <div className="segment-bar">
                        <div className="segment-bar-fill" style={{ width: `${segment.percent}%`, backgroundColor: segment.color }} />
                      </div>
                      <small>{segment.value} articles</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <h3>Word Cloud</h3>
              </div>
              <div className="card-body">
                <div className="wordcloud-container">
                  {wordStats.slice(0, 30).map((word) => {
                    const avg = word.count ? word.sentimentSum / word.count : 0;
                    return (
                      <span
                        key={word.word}
                        className={`word-item ${getHeatmapClass(avg)}`}
                        style={{ fontSize: `${Math.min(30, 12 + word.count)}px` }}
                        title={`${word.word} · ${word.count} mentions`}
                      >
                        {word.word}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <h3>Source Analysis</h3>
              </div>
              <div className="card-body">
                <ul className="source-list">
                  {sourceInsights.slice(0, 8).map((source) => (
                    <li key={source.source} className="source-item">
                      <div>
                        <strong>{source.source}</strong>
                        <div className="entity-stats">{source.count} articles</div>
                      </div>
                      <div className="entity-sentiment" style={{ color: source.averageSentiment >= 0 ? '#15803d' : '#dc2626' }}>
                        {source.averageSentiment.toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card chart-card">
              <div className="card-header">
                <h3>Topic Clusters</h3>
              </div>
              <div className="card-body">
                <div className="topic-grid">
                  {topicInsights.map((topic) => (
                    <div key={topic.name} className="topic-card">
                      <div className="topic-name">{topic.name}</div>
                      <div className="topic-count">{topic.count} articles</div>
                      <div className="entity-sentiment" style={{ color: topic.averageSentiment >= 0 ? '#15803d' : '#dc2626' }}>
                        {topic.averageSentiment.toFixed(2)} avg
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card full-width">
              <div className="card-header">
                <h3>Entity Comparison</h3>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Entity</th>
                        <th>Sentiment Score</th>
                        <th>Positive %</th>
                        <th>Negative %</th>
                        <th>Neutral %</th>
                        <th>Mentions</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entityInsights.length ? (
                        entityInsights.slice(0, 10).map((entity) => (
                          <tr key={entity.name}>
                            <td>{entity.name}</td>
                            <td>{entity.averageSentiment.toFixed(2)}</td>
                            <td>{entity.positivePercent}%</td>
                            <td>{entity.negativePercent}%</td>
                            <td>{entity.neutralPercent}%</td>
                            <td>{entity.mentions}</td>
                            <td>{getTrendArrow(entity.averageSentiment)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="placeholder-text">
                            Entity data will appear here once there are articles with identified entities.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="watchlistView" className={renderViewClass('watchlist')}>
          <div className="watchlist-grid">
            <div className="card">
              <div className="card-header">
                <h3>Watchlist Manager</h3>
              </div>
              <div className="card-body">
                <div className="add-watchlist-form">
                  <input
                    type="text"
                    placeholder="Enter entity name..."
                    value={watchlistInput}
                    onChange={(event) => setWatchlistInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleWatchlistSubmit();
                      }
                    }}
                  />
                  <button className="btn btn-primary" onClick={handleWatchlistSubmit}>Add to Watchlist</button>
                </div>
                <div className="watchlist-items" id="watchlistItems">
                  {watchlist.length === 0 ? (
                    <p className="placeholder-text">No items yet.</p>
                  ) : (
                    watchlist.map((item) => (
                      <div key={item.name} className="watchlist-item">
                        <div className="watchlist-item-info">
                          <div className="watchlist-item-name">{item.name}</div>
                          <div className="watchlist-item-sentiment">Sentiment: {item.sentiment.toFixed(2)}</div>
                        </div>
                        <div className="watchlist-item-actions">
                          <label className="switch" title="Enable alerts">
                            <input
                              type="checkbox"
                              checked={item.alertEnabled}
                              onChange={() => handleWatchlistToggle(item.name)}
                            />
                            <span className="slider" />
                          </label>
                          <button className="btn btn-danger btn-small" onClick={() => handleWatchlistRemove(item.name)}>Remove</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Watchlist Stats</h3>
              </div>
              <div className="card-body">
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-label">Total Watched</div>
                    <div className="stat-value" id="totalWatched">{watchlistStats.totalWatched}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Positive Trend</div>
                    <div className="stat-value positive" id="positiveTrend">{watchlistStats.positiveTrend}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Negative Trend</div>
                    <div className="stat-value negative" id="negativeTrend">{watchlistStats.negativeTrend}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Active Alerts</div>
                    <div className="stat-value" id="activeAlertsCount">{watchlistStats.activeAlerts}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card chart-card full-width">
              <div className="card-header">
                <h3>Watchlist Sentiment Trends</h3>
              </div>
              <div className="card-body">
                <div className="chart-container">
                  <canvas id="watchlistChart" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="alertsView" className={renderViewClass('alerts')}>
          <div className="alerts-grid">
            <div className="card">
              <div className="card-header">
                <h3>Create Alert</h3>
              </div>
              <div className="card-body">
                <form className="alert-form" onSubmit={handleAlertCreation}>
                  <div className="form-group">
                    <label htmlFor="alertEntity">Entity/Topic</label>
                    <select id="alertEntity" name="alertEntity" defaultValue="">
                      <option value="">Select entity...</option>
                      {watchlist.map((item) => (
                        <option key={item.name} value={item.name}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="alertType">Alert Type</label>
                    <select id="alertType" name="alertType" defaultValue="spike">
                      {ALERT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Threshold: <span id="thresholdValue">30</span>%</label>
                    <input
                      type="range"
                      id="alertThreshold"
                      name="alertThreshold"
                      min="10"
                      max="50"
                      defaultValue="30"
                      onChange={(event) => {
                        const value = event.target.value;
                        const display = document.getElementById('thresholdValue');
                        if (display) display.textContent = value;
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Notifications</label>
                    <div className="checkbox-group">
                      <label><input type="checkbox" defaultChecked /> In-App</label>
                      <label><input type="checkbox" /> Email</label>
                      <label><input type="checkbox" /> SMS</label>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">Save Alert</button>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Active Alerts</h3>
              </div>
              <div className="card-body">
                <div className="alerts-list" id="activeAlertsList">
                  {alerts.length === 0 ? (
                    <p className="placeholder-text">No active alerts.</p>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className={`alert-card ${alert.priority}`}>
                        <div className="alert-header">
                          <span className={`alert-badge ${alert.priority}`}>{alert.priority}</span>
                        </div>
                        <div className="alert-title">{alert.entity}</div>
                        <div className="alert-details">
                          {alert.type} - {alert.change}% change
                          <br />
                          <small>{new Date(alert.timestamp).toLocaleString()}</small>
                        </div>
                        <div className="alert-actions">
                          <button className="btn btn-small btn-secondary" disabled>
                            View Details
                          </button>
                          <button className="btn btn-small btn-danger" onClick={() => handleAlertDismiss(alert.id)}>
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="card full-width">
              <div className="card-header">
                <h3>Alert History</h3>
              </div>
              <div className="card-body">
                <div className="table-container">
                  <table className="alerts-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Entity</th>
                        <th>Alert Type</th>
                        <th>Sentiment Change</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="placeholder-text">No history yet.</td>
                        </tr>
                      ) : (
                        alertHistory.map((alert) => (
                          <tr key={alert.id}>
                            <td>{new Date(alert.timestamp).toLocaleString()}</td>
                            <td>{alert.entity}</td>
                            <td>{alert.type}</td>
                            <td className={alert.change > 0 ? 'text-success' : 'text-danger'}>
                              {alert.change > 0 ? '+' : ''}{alert.change}%
                            </td>
                            <td>
                              <span className={`alert-badge ${alert.priority}`}>{alert.status}</span>
                            </td>
                            <td>
                              <button className="btn btn-small btn-secondary" disabled>
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="settingsView" className={renderViewClass('settings')}>
          <div className="settings-grid">
            <div className="card">
              <div className="card-header">
                <h3>Dashboard Preferences</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label htmlFor="defaultTimeRange">Default Time Range</label>
                  <select id="defaultTimeRange" value={filters.dateRange} onChange={(event) => setFilters((prev) => ({ ...prev, dateRange: event.target.value as Filters['dateRange'] }))}>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Auto-Refresh Interval: <span id="refreshValue">5</span>s</label>
                  <input
                    type="range"
                    id="refreshInterval"
                    min="5"
                    max="60"
                    defaultValue="5"
                    step="5"
                    onChange={(event) => {
                      const display = document.getElementById('refreshValue');
                      if (display) display.textContent = event.target.value;
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="defaultChartType">Chart Type</label>
                  <select id="defaultChartType" defaultValue="line">
                    <option value="line">Line Chart</option>
                    <option value="bar">Bar Chart</option>
                    <option value="area">Area Chart</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Alert Settings</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label>Default Threshold: <span id="defaultThresholdValue">30</span>%</label>
                  <input
                    type="range"
                    id="defaultThreshold"
                    min="10"
                    max="50"
                    defaultValue="30"
                    onChange={(event) => {
                      const display = document.getElementById('defaultThresholdValue');
                      if (display) display.textContent = event.target.value;
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Quiet Hours</label>
                  <div className="time-range">
                    <input type="time" defaultValue="22:00" />
                    <span>to</span>
                    <input type="time" defaultValue="08:00" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Sound Notifications</label>
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Data Sources</h3>
              </div>
              <div className="card-body">
                <div className="sources-list">
                  {['BBC News', 'Bloomberg', 'Reuters', 'CNN', 'TechCrunch'].map((source) => (
                    <label className="source-item" key={source}>
                      <input type="checkbox" defaultChecked />
                      <span>{source}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Theme Customization</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label>Color Scheme</label>
                  <div className="theme-options">
                    <button className="theme-option" data-theme="dark" onClick={() => setTheme('dark')}>🌙 Dark</button>
                    <button className="theme-option" data-theme="light" onClick={() => setTheme('light')}>☀️ Light</button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Font Size</label>
                  <select defaultValue="medium">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="toast-container" aria-live="assertive">
        {toastQueue.map((toast) => (
          <div key={toast.id} className="toast">{toast.text}</div>
        ))}
      </div>

      <button
        className={`chatbot-toggle-btn ${isChatOpen ? 'hidden' : ''}`}
        id="chatbotToggleBtn"
        title="Open AI Assistant"
        onClick={toggleChatOpen}
      >
        💬
      </button>

      <div className={`chatbot-container ${isChatOpen ? 'active' : ''}`} id="chatbotContainer" role="dialog" aria-modal="true">
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <span className="chatbot-icon">🤖</span>
            <div className="chatbot-title-group">
              <h3 className="chatbot-title">AI Sentiment Assistant</h3>
              <span className="chatbot-status">● Online</span>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button className="chatbot-header-btn" id="clearChatBtn" title="Clear chat" onClick={clearChat}>🗑️</button>
            <button className="chatbot-header-btn" id="closeChatBtn" title="Close" onClick={closeChat}>✕</button>
          </div>
        </div>

        <div className="chatbot-messages" id="chatbotMessages">
          {chatMessages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role === 'user' ? 'user-message' : 'bot-message'}`}>
              <div className="message-avatar">{message.role === 'user' ? '🧑' : '🤖'}</div>
              <div className="message-content">
                <div className="message-text">{message.text}</div>
                {message.sentiment && (
                  <span className={`sentiment-badge ${message.sentiment}`}>
                    Sentiment: {message.sentiment}
                  </span>
                )}
                <div className="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}

          {isChatTyping && (
            <div className="chat-message bot-message typing-indicator">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="message-text">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          {suggestionsVisible && (
            <div className="suggested-questions" id="suggestedQuestions">
              <div className="suggested-label">Try asking:</div>
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  className="suggested-question"
                  data-question={question}
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chatbot-input-container">
          <textarea
            className="chatbot-input"
            id="chatbotInput"
            placeholder="Ask about sentiment, news, trends..."
            rows={1}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendChatMessage();
              }
            }}
          />
          <button
            className="chatbot-send-btn"
            id="chatbotSendBtn"
            title="Send message"
            onClick={() => sendChatMessage()}
            disabled={!chatInput.trim()}
          >
            <span className="send-icon">📤</span>
          </button>
        </div>
      </div>

      {isModalOpen && selectedArticle && (
        <div className="modal" onClick={closeArticleModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedArticle.headline}</h2>
              <button className="modal-close" onClick={closeArticleModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="article-meta">
                <span className="article-source">{selectedArticle.source || 'Unknown source'}</span>
                <span className="article-timestamp">
                  {selectedArticle.publishedAt ? new Date(selectedArticle.publishedAt).toLocaleString() : '—'}
                </span>
              </div>
              <div className="sentiment-breakdown">
                <h3>Sentiment Analysis</h3>
                <div className="sentiment-scores">
                  <div className="score-item">
                    <label>Score</label>
                    <span>{selectedArticle.sentimentScore?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                  <div className="score-item">
                    <label>Label</label>
                    <span>{selectedArticle.sentimentLabel ?? 'Unknown'}</span>
                  </div>
                  <div className="score-item">
                    <label>VADER</label>
                    <span>{selectedArticle.vaderScore?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                  <div className="score-item">
                    <label>DistilBERT</label>
                    <span>{selectedArticle.transformerScore?.toFixed(2) ?? 'N/A'}</span>
                  </div>
                </div>
              </div>
              <div className="entity-tags">
                <h3>Identified Entities</h3>
                <div className="tags-container">
                  {(selectedArticle.entities || []).length === 0 ? (
                    <span className="tag">No entities available</span>
                  ) : (
                    (selectedArticle.entities || []).map((entity) => (
                      <span key={entity} className="tag">{entity}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="article-preview">
                <h3>Article Preview</h3>
                <p>{selectedArticle.content || 'No article preview available yet.'}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" disabled>
                Share
              </button>
              <button className="btn btn-primary" disabled>
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}