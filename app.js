// Application State
const AppState = {
  currentView: 'dashboard',
  theme: 'light',
  articles: [],
  entities: [],
  watchlist: [],
  alerts: [],
  alertHistory: [],
  filters: {
    dateRange: '7d',
    source: 'all',
    sentiment: { positive: true, negative: true, neutral: true },
    search: ''
  },
  charts: {},
  refreshInterval: null
};

// Mock Data Generator
const DataGenerator = {
  sources: ['BBC News', 'CNN', 'Reuters', 'Bloomberg', 'TechCrunch', 'Wall Street Journal', 'Financial Times', 'The Guardian', 'Al Jazeera', 'Associated Press'],
  
  companies: ['Apple', 'Tesla', 'Microsoft', 'Amazon', 'Google', 'Meta', 'Netflix', 'NVIDIA', 'IBM', 'Intel', 'Oracle', 'Adobe', 'Salesforce', 'PayPal', 'Cisco'],
  
  people: ['Elon Musk', 'Tim Cook', 'Satya Nadella', 'Jeff Bezos', 'Mark Zuckerberg', 'Sundar Pichai', 'Jensen Huang', 'Lisa Su'],
  
  topics: ['Artificial Intelligence', 'Climate Change', 'Cryptocurrency', 'Economy', 'Healthcare', 'Technology', 'Politics', 'Energy', 'Space', 'Cybersecurity'],
  
  countries: ['United States', 'United Kingdom', 'Germany', 'France', 'China', 'India', 'Japan', 'Brazil', 'Canada', 'Australia', 'South Korea', 'Italy', 'Spain', 'Netherlands', 'Switzerland'],
  
  positiveWords: ['innovation', 'growth', 'success', 'breakthrough', 'achievement', 'profit', 'surge', 'excellent', 'optimistic', 'partnership'],
  
  negativeWords: ['decline', 'crisis', 'failure', 'concern', 'risk', 'loss', 'controversy', 'scandal', 'threat', 'uncertainty'],
  
  generateHeadline: function(entity, sentiment) {
    const templates = {
      positive: [
        `${entity} Reports Record-Breaking Quarter`,
        `${entity} Announces Major Innovation`,
        `${entity} Stock Soars on Positive Earnings`,
        `${entity} Partners with Industry Leaders`,
        `${entity} Achieves Significant Milestone`
      ],
      negative: [
        `${entity} Faces Regulatory Challenges`,
        `${entity} Stock Declines Amid Concerns`,
        `${entity} Reports Disappointing Results`,
        `${entity} Under Investigation`,
        `${entity} Struggles with Market Competition`
      ],
      neutral: [
        `${entity} Releases Quarterly Report`,
        `${entity} Announces New Strategy`,
        `${entity} Updates Product Lineup`,
        `${entity} Holds Annual Meeting`,
        `${entity} Expands Operations`
      ]
    };
    
    const category = sentiment > 0.3 ? 'positive' : sentiment < -0.3 ? 'negative' : 'neutral';
    const template = templates[category][Math.floor(Math.random() * templates[category].length)];
    return template;
  },
  
  generateArticle: function(hoursAgo = null) {
    const allEntities = [...this.companies, ...this.people, ...this.topics];
    const entity = allEntities[Math.floor(Math.random() * allEntities.length)];
    const sentimentVader = (Math.random() * 2) - 1;
    const sentimentBert = sentimentVader + ((Math.random() - 0.5) * 0.3);
    const sentimentEnsemble = (sentimentVader * 0.4) + (sentimentBert * 0.6);
    
    const timestamp = new Date();
    if (hoursAgo !== null) {
      timestamp.setHours(timestamp.getHours() - hoursAgo);
    } else {
      timestamp.setHours(timestamp.getHours() - Math.floor(Math.random() * 168)); // Random within 7 days
    }
    
    return {
      id: `article-${Date.now()}-${Math.random()}`,
      headline: this.generateHeadline(entity, sentimentEnsemble),
      source: this.sources[Math.floor(Math.random() * this.sources.length)],
      timestamp: timestamp.toISOString(),
      sentiment_vader: parseFloat(sentimentVader.toFixed(2)),
      sentiment_bert: parseFloat(sentimentBert.toFixed(2)),
      sentiment_ensemble: parseFloat(sentimentEnsemble.toFixed(2)),
      entities: [entity, ...this.getRandomEntities(2)],
      country: this.countries[Math.floor(Math.random() * this.countries.length)],
      category: ['Business', 'Technology', 'Politics', 'Economy'][Math.floor(Math.random() * 4)],
      content: this.generateContent(sentimentEnsemble)
    };
  },
  
  getRandomEntities: function(count) {
    const allEntities = [...this.companies, ...this.people, ...this.topics];
    const result = [];
    for (let i = 0; i < count; i++) {
      const entity = allEntities[Math.floor(Math.random() * allEntities.length)];
      if (!result.includes(entity)) {
        result.push(entity);
      }
    }
    return result;
  },
  
  generateContent: function(sentiment) {
    const words = sentiment > 0 ? this.positiveWords : this.negativeWords;
    const intro = `In a recent development, industry analysts have noted ${words[Math.floor(Math.random() * words.length)]} trends.`;
    const body = `Market observers report ${words[Math.floor(Math.random() * words.length)]} indicators suggesting significant implications for stakeholders. The situation continues to evolve as experts monitor key metrics and performance indicators.`;
    return `${intro} ${body}`;
  },
  
  generateInitialData: function(count = 100) {
    const articles = [];
    for (let i = 0; i < count; i++) {
      articles.push(this.generateArticle());
    }
    return articles;
  }
};

// Initialize Application
function initializeApp() {
  // Generate initial data
  AppState.articles = DataGenerator.generateInitialData(100);
  
  // Extract unique entities
  const entitySet = new Set();
  AppState.articles.forEach(article => {
    article.entities.forEach(entity => entitySet.add(entity));
  });
  
  AppState.entities = Array.from(entitySet).map(name => ({
    name,
    sentiment: calculateEntitySentiment(name),
    mentions: countEntityMentions(name)
  }));
  
  // Initialize default watchlist
  AppState.watchlist = ['Tesla', 'Apple', 'Microsoft'].map(name => ({
    name,
    sentiment: calculateEntitySentiment(name),
    alertEnabled: true
  }));
  
  // Generate sample alerts
  generateSampleAlerts();
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize views
  renderDashboard();
  renderAnalytics();
  renderWatchlist();
  renderAlerts();
  renderSettings();
  
  // Start real-time updates
  startRealTimeUpdates();
  
  // Apply saved theme
  const savedTheme = AppState.theme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      switchView(e.target.dataset.view);
    });
  });
  
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  
  // Filters
  document.getElementById('dateRangeFilter').addEventListener('change', (e) => {
    AppState.filters.dateRange = e.target.value;
    applyFilters();
  });
  
  document.getElementById('sourceFilter').addEventListener('change', (e) => {
    AppState.filters.source = e.target.value;
    applyFilters();
  });
  
  document.getElementById('filterPositive').addEventListener('change', (e) => {
    AppState.filters.sentiment.positive = e.target.checked;
    applyFilters();
  });
  
  document.getElementById('filterNegative').addEventListener('change', (e) => {
    AppState.filters.sentiment.negative = e.target.checked;
    applyFilters();
  });
  
  document.getElementById('filterNeutral').addEventListener('change', (e) => {
    AppState.filters.sentiment.neutral = e.target.checked;
    applyFilters();
  });
  
  document.getElementById('searchInput').addEventListener('input', debounce((e) => {
    AppState.filters.search = e.target.value.toLowerCase();
    applyFilters();
  }, 300));
  
  // Watchlist
  document.getElementById('addToWatchlistBtn').addEventListener('click', addToWatchlist);
  document.getElementById('watchlistInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addToWatchlist();
  });
  
  // Alerts
  document.getElementById('alertForm').addEventListener('submit', (e) => {
    e.preventDefault();
    createAlert();
  });
  
  document.getElementById('alertThreshold').addEventListener('input', (e) => {
    document.getElementById('thresholdValue').textContent = e.target.value;
  });
  
  // Settings
  document.getElementById('refreshInterval').addEventListener('input', (e) => {
    document.getElementById('refreshValue').textContent = e.target.value;
  });
  
  document.getElementById('defaultThreshold').addEventListener('input', (e) => {
    document.getElementById('defaultThresholdValue').textContent = e.target.value;
  });
  
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = e.target.dataset.theme;
      AppState.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeIcon(theme);
    });
  });
  
  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('articleModal').addEventListener('click', (e) => {
    if (e.target.id === 'articleModal') closeModal();
  });
}

// View Management
function switchView(viewName) {
  AppState.currentView = viewName;
  
  // Update active tab
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
  
  // Show active view
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.id === `${viewName}View`);
  });
  
  // Refresh charts for the active view
  setTimeout(() => {
    if (viewName === 'dashboard') updateDashboardCharts();
    if (viewName === 'analytics') updateAnalyticsCharts();
    if (viewName === 'watchlist') updateWatchlistChart();
  }, 100);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  AppState.theme = newTheme;
  document.documentElement.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme);
  
  // Update all charts with new theme
  Object.values(AppState.charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  AppState.charts = {};
  
  if (AppState.currentView === 'dashboard') updateDashboardCharts();
  if (AppState.currentView === 'analytics') updateAnalyticsCharts();
  if (AppState.currentView === 'watchlist') updateWatchlistChart();
}

function updateThemeIcon(theme) {
  const icon = theme === 'dark' ? '☀️' : '🌙';
  document.querySelector('.theme-icon').textContent = icon;
}

// Dashboard Rendering
function renderDashboard() {
  updateOverviewCards();
  updateDashboardCharts();
  renderTopEntities();
  renderGeographicHeatmap();
}

function updateOverviewCards() {
  const filteredArticles = getFilteredArticles();
  
  const positive = filteredArticles.filter(a => a.sentiment_ensemble > 0.2).length;
  const negative = filteredArticles.filter(a => a.sentiment_ensemble < -0.2).length;
  const neutral = filteredArticles.filter(a => Math.abs(a.sentiment_ensemble) <= 0.2).length;
  
  const avgSentiment = filteredArticles.reduce((sum, a) => sum + a.sentiment_ensemble, 0) / filteredArticles.length || 0;
  
  document.getElementById('overallSentiment').textContent = avgSentiment.toFixed(2);
  document.getElementById('positiveCount').textContent = positive;
  document.getElementById('negativeCount').textContent = negative;
  document.getElementById('neutralCount').textContent = neutral;
}

function updateDashboardCharts() {
  createSentimentTrendChart();
}

function createSentimentTrendChart() {
  const ctx = document.getElementById('sentimentTrendChart');
  if (!ctx) return;
  
  if (AppState.charts.sentimentTrend) {
    AppState.charts.sentimentTrend.destroy();
  }
  
  const hours = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setHours(date.getHours() - (23 - i));
    return date.getHours() + ':00';
  });
  
  const positiveData = Array.from({ length: 24 }, () => Math.random() * 0.5 + 0.3);
  const negativeData = Array.from({ length: 24 }, () => Math.random() * 0.3 - 0.5);
  const neutralData = Array.from({ length: 24 }, () => Math.random() * 0.2 - 0.1);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f5f5f5' : '#134252';
  const gridColor = isDark ? 'rgba(119, 124, 124, 0.2)' : 'rgba(94, 82, 64, 0.2)';
  
  AppState.charts.sentimentTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Positive',
          data: positiveData,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        },
        {
          label: 'Negative',
          data: negativeData,
          borderColor: '#f44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4
        },
        {
          label: 'Neutral',
          data: neutralData,
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function renderTopEntities() {
  const container = document.getElementById('topEntitiesList');
  const topEntities = AppState.entities
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);
  
  container.innerHTML = topEntities.map(entity => `
    <div class="entity-item" onclick="filterByEntity('${entity.name}')">
      <div class="entity-info">
        <div class="entity-name">${entity.name}</div>
        <div class="entity-stats">${entity.mentions} mentions</div>
      </div>
      <div class="entity-sentiment" style="color: ${getSentimentColor(entity.sentiment)}">
        ${entity.sentiment.toFixed(2)}
      </div>
      <div class="entity-trend">${entity.sentiment > 0 ? '↗' : entity.sentiment < 0 ? '↘' : '→'}</div>
    </div>
  `).join('');
}

function renderGeographicHeatmap() {
  const container = document.getElementById('geoHeatmap');
  const countries = DataGenerator.countries.map(name => {
    const articles = AppState.articles.filter(a => a.country === name);
    const sentiment = articles.length > 0
      ? articles.reduce((sum, a) => sum + a.sentiment_ensemble, 0) / articles.length
      : 0;
    return { name, sentiment };
  });
  
  container.innerHTML = countries.map(country => {
    const sentimentClass = country.sentiment > 0.15 ? 'positive' : country.sentiment < -0.15 ? 'negative' : 'neutral';
    return `
      <div class="heatmap-item ${sentimentClass}" onclick="showCountryDetails('${country.name}')">
        <div class="country-name">${country.name}</div>
        <div class="country-sentiment" style="color: ${getSentimentColor(country.sentiment)}">
          ${country.sentiment.toFixed(2)}
        </div>
      </div>
    `;
  }).join('');
}

// Analytics Rendering
function renderAnalytics() {
  updateAnalyticsCharts();
  renderWordCloud();
  renderComparisonTable();
}

function updateAnalyticsCharts() {
  createSentimentPieChart();
  createSourceChart();
  createTopicChart();
}

function createSentimentPieChart() {
  const ctx = document.getElementById('sentimentPieChart');
  if (!ctx) return;
  
  if (AppState.charts.sentimentPie) {
    AppState.charts.sentimentPie.destroy();
  }
  
  const filteredArticles = getFilteredArticles();
  const positive = filteredArticles.filter(a => a.sentiment_ensemble > 0.2).length;
  const negative = filteredArticles.filter(a => a.sentiment_ensemble < -0.2).length;
  const neutral = filteredArticles.filter(a => Math.abs(a.sentiment_ensemble) <= 0.2).length;
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f5f5f5' : '#134252';
  
  AppState.charts.sentimentPie = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Positive', 'Negative', 'Neutral'],
      datasets: [{
        data: [positive, negative, neutral],
        backgroundColor: ['#4caf50', '#f44336', '#ffc107']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      }
    }
  });
}

function createSourceChart() {
  const ctx = document.getElementById('sourceChart');
  if (!ctx) return;
  
  if (AppState.charts.sourceChart) {
    AppState.charts.sourceChart.destroy();
  }
  
  const sourceCounts = {};
  AppState.articles.forEach(article => {
    sourceCounts[article.source] = (sourceCounts[article.source] || 0) + 1;
  });
  
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f5f5f5' : '#134252';
  const gridColor = isDark ? 'rgba(119, 124, 124, 0.2)' : 'rgba(94, 82, 64, 0.2)';
  
  AppState.charts.sourceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topSources.map(s => s[0]),
      datasets: [{
        label: 'Article Count',
        data: topSources.map(s => s[1]),
        backgroundColor: '#1FB8CD'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function createTopicChart() {
  const ctx = document.getElementById('topicChart');
  if (!ctx) return;
  
  if (AppState.charts.topicChart) {
    AppState.charts.topicChart.destroy();
  }
  
  const topics = DataGenerator.topics.slice(0, 8);
  const topicData = topics.map(() => Math.floor(Math.random() * 50) + 10);
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f5f5f5' : '#134252';
  
  AppState.charts.topicChart = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: topics.map((topic, i) => ({
        label: topic,
        data: [{
          x: Math.random() * 100,
          y: Math.random() * 100,
          r: topicData[i] / 2
        }],
        backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454'][i]
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      }
    }
  });
}

function renderWordCloud() {
  const container = document.getElementById('wordCloud');
  const positiveWords = DataGenerator.positiveWords;
  const negativeWords = DataGenerator.negativeWords;
  
  const allWords = [
    ...positiveWords.map(word => ({ word, type: 'positive', size: Math.random() * 16 + 12 })),
    ...negativeWords.map(word => ({ word, type: 'negative', size: Math.random() * 16 + 12 }))
  ];
  
  container.innerHTML = allWords.map(item => `
    <span class="word-item ${item.type}" style="font-size: ${item.size}px;">
      ${item.word}
    </span>
  `).join('');
}

function renderComparisonTable() {
  const tbody = document.getElementById('comparisonTableBody');
  const topEntities = AppState.entities.slice(0, 5);
  
  tbody.innerHTML = topEntities.map(entity => {
    const entityArticles = AppState.articles.filter(a => a.entities.includes(entity.name));
    const positive = entityArticles.filter(a => a.sentiment_ensemble > 0.2).length;
    const negative = entityArticles.filter(a => a.sentiment_ensemble < -0.2).length;
    const neutral = entityArticles.filter(a => Math.abs(a.sentiment_ensemble) <= 0.2).length;
    const total = entityArticles.length;
    
    return `
      <tr>
        <td><strong>${entity.name}</strong></td>
        <td style="color: ${getSentimentColor(entity.sentiment)}">${entity.sentiment.toFixed(2)}</td>
        <td>${total > 0 ? ((positive / total) * 100).toFixed(1) : 0}%</td>
        <td>${total > 0 ? ((negative / total) * 100).toFixed(1) : 0}%</td>
        <td>${total > 0 ? ((neutral / total) * 100).toFixed(1) : 0}%</td>
        <td>${entity.mentions}</td>
        <td>${entity.sentiment > 0 ? '↗ Positive' : entity.sentiment < 0 ? '↘ Negative' : '→ Stable'}</td>
      </tr>
    `;
  }).join('');
}

// Watchlist Rendering
function renderWatchlist() {
  renderWatchlistItems();
  updateWatchlistStats();
  updateWatchlistChart();
  populateAlertEntityDropdown();
}

function renderWatchlistItems() {
  const container = document.getElementById('watchlistItems');
  
  if (AppState.watchlist.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">No items in watchlist. Add entities to start monitoring.</p>';
    return;
  }
  
  container.innerHTML = AppState.watchlist.map((item, index) => `
    <div class="watchlist-item">
      <div class="watchlist-item-info">
        <div class="watchlist-item-name">${item.name}</div>
        <div class="watchlist-item-sentiment" style="color: ${getSentimentColor(item.sentiment)}">
          Sentiment: ${item.sentiment.toFixed(2)}
        </div>
      </div>
      <div class="watchlist-item-actions">
        <label class="switch" title="Enable alerts">
          <input type="checkbox" ${item.alertEnabled ? 'checked' : ''} onchange="toggleWatchlistAlert(${index})">
          <span class="slider"></span>
        </label>
        <button class="btn btn-danger btn-small" onclick="removeFromWatchlist(${index})">Remove</button>
      </div>
    </div>
  `).join('');
}

function updateWatchlistStats() {
  document.getElementById('totalWatched').textContent = AppState.watchlist.length;
  const positiveTrend = AppState.watchlist.filter(item => item.sentiment > 0.2).length;
  const negativeTrend = AppState.watchlist.filter(item => item.sentiment < -0.2).length;
  document.getElementById('positiveTrend').textContent = positiveTrend;
  document.getElementById('negativeTrend').textContent = negativeTrend;
  document.getElementById('activeAlertsCount').textContent = AppState.alerts.length;
}

function updateWatchlistChart() {
  const ctx = document.getElementById('watchlistChart');
  if (!ctx) return;
  
  if (AppState.charts.watchlistChart) {
    AppState.charts.watchlistChart.destroy();
  }
  
  if (AppState.watchlist.length === 0) {
    return;
  }
  
  const hours = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setHours(date.getHours() - (23 - i));
    return date.getHours() + ':00';
  });
  
  const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#5D878F', '#DB4545'];
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f5f5f5' : '#134252';
  const gridColor = isDark ? 'rgba(119, 124, 124, 0.2)' : 'rgba(94, 82, 64, 0.2)';
  
  AppState.charts.watchlistChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: AppState.watchlist.map((item, i) => ({
        label: item.name,
        data: Array.from({ length: 24 }, () => Math.random() * 1.5 - 0.75),
        borderColor: colors[i % colors.length],
        tension: 0.4,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: textColor }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor }
        }
      }
    }
  });
}

function addToWatchlist() {
  const input = document.getElementById('watchlistInput');
  const entityName = input.value.trim();
  
  if (!entityName) {
    showToast('Please enter an entity name', 'error');
    return;
  }
  
  if (AppState.watchlist.some(item => item.name.toLowerCase() === entityName.toLowerCase())) {
    showToast('Entity already in watchlist', 'warning');
    return;
  }
  
  const sentiment = calculateEntitySentiment(entityName);
  AppState.watchlist.push({
    name: entityName,
    sentiment,
    alertEnabled: true
  });
  
  input.value = '';
  renderWatchlistItems();
  updateWatchlistStats();
  updateWatchlistChart();
  populateAlertEntityDropdown();
  showToast(`Added ${entityName} to watchlist`, 'success');
}

function removeFromWatchlist(index) {
  const item = AppState.watchlist[index];
  AppState.watchlist.splice(index, 1);
  renderWatchlistItems();
  updateWatchlistStats();
  updateWatchlistChart();
  populateAlertEntityDropdown();
  showToast(`Removed ${item.name} from watchlist`, 'success');
}

function toggleWatchlistAlert(index) {
  AppState.watchlist[index].alertEnabled = !AppState.watchlist[index].alertEnabled;
  showToast(`Alerts ${AppState.watchlist[index].alertEnabled ? 'enabled' : 'disabled'} for ${AppState.watchlist[index].name}`, 'info');
}

// Alerts Rendering
function renderAlerts() {
  renderActiveAlerts();
  renderAlertHistory();
  populateAlertEntityDropdown();
}

function populateAlertEntityDropdown() {
  const select = document.getElementById('alertEntity');
  const allEntities = [...new Set([...AppState.watchlist.map(w => w.name), ...AppState.entities.slice(0, 20).map(e => e.name)])];
  
  select.innerHTML = '<option value="">Select entity...</option>' + 
    allEntities.map(entity => `<option value="${entity}">${entity}</option>`).join('');
}

function renderActiveAlerts() {
  const container = document.getElementById('activeAlertsList');
  
  if (AppState.alerts.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">No active alerts</p>';
    return;
  }
  
  container.innerHTML = AppState.alerts.map((alert, index) => `
    <div class="alert-card ${alert.priority}">
      <div class="alert-header">
        <span class="alert-badge ${alert.priority}">${alert.priority}</span>
      </div>
      <div class="alert-title">${alert.entity}</div>
      <div class="alert-details">
        ${alert.type} - ${alert.change}% change<br>
        <small>${formatTimestamp(alert.timestamp)}</small>
      </div>
      <div class="alert-actions">
        <button class="btn btn-small btn-secondary" onclick="viewAlertDetails(${index})">View Details</button>
        <button class="btn btn-small btn-danger" onclick="dismissAlert(${index})">Dismiss</button>
      </div>
    </div>
  `).join('');
}

function renderAlertHistory() {
  const tbody = document.getElementById('alertHistoryBody');
  
  if (AppState.alertHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary);">No alert history</td></tr>';
    return;
  }
  
  tbody.innerHTML = AppState.alertHistory.slice(0, 10).map(alert => `
    <tr>
      <td>${formatTimestamp(alert.timestamp)}</td>
      <td>${alert.entity}</td>
      <td>${alert.type}</td>
      <td style="color: ${alert.change > 0 ? 'var(--color-success)' : 'var(--color-error)'}">${alert.change > 0 ? '+' : ''}${alert.change}%</td>
      <td><span class="alert-badge ${alert.priority}">${alert.status}</span></td>
      <td><button class="btn btn-small btn-secondary">View</button></td>
    </tr>
  `).join('');
}

function createAlert() {
  const entity = document.getElementById('alertEntity').value;
  const type = document.getElementById('alertType').value;
  const threshold = document.getElementById('alertThreshold').value;
  
  if (!entity) {
    showToast('Please select an entity', 'error');
    return;
  }
  
  const newAlert = {
    entity,
    type: getAlertTypeLabel(type),
    threshold: parseInt(threshold),
    timestamp: new Date().toISOString(),
    priority: 'emerging',
    change: Math.floor(Math.random() * 30) + 10,
    status: 'active'
  };
  
  AppState.alerts.push(newAlert);
  renderActiveAlerts();
  updateWatchlistStats();
  showToast(`Alert created for ${entity}`, 'success');
  document.getElementById('alertForm').reset();
}

function getAlertTypeLabel(type) {
  const labels = {
    spike: 'Sentiment Spike',
    emerging: 'Emerging Trend',
    volume: 'Volume Surge',
    sustained: 'Sustained Negative'
  };
  return labels[type] || type;
}

function dismissAlert(index) {
  const alert = AppState.alerts[index];
  alert.status = 'dismissed';
  AppState.alertHistory.unshift(alert);
  AppState.alerts.splice(index, 1);
  renderActiveAlerts();
  renderAlertHistory();
  updateWatchlistStats();
  showToast('Alert dismissed', 'info');
}

function viewAlertDetails(index) {
  const alert = AppState.alerts[index];
  const articles = AppState.articles.filter(a => a.entities.includes(alert.entity)).slice(0, 1);
  if (articles.length > 0) {
    showArticleModal(articles[0]);
  }
}

function generateSampleAlerts() {
  const sampleEntities = ['Tesla', 'Apple', 'Climate Change'];
  const priorities = ['emerging', 'escalating', 'critical'];
  
  for (let i = 0; i < 3; i++) {
    AppState.alerts.push({
      entity: sampleEntities[i],
      type: 'Sentiment Spike',
      threshold: 30,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      priority: priorities[i],
      change: Math.floor(Math.random() * 40) + 30,
      status: 'active'
    });
  }
  
  for (let i = 0; i < 5; i++) {
    AppState.alertHistory.push({
      entity: sampleEntities[Math.floor(Math.random() * sampleEntities.length)],
      type: 'Volume Surge',
      threshold: 25,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      priority: 'emerging',
      change: Math.floor(Math.random() * 50) - 25,
      status: 'resolved'
    });
  }
}

// Settings Rendering
function renderSettings() {
  // Settings are already rendered in HTML, this is just a placeholder
}

// Utility Functions
function getFilteredArticles() {
  return AppState.articles.filter(article => {
    // Date filter
    const articleDate = new Date(article.timestamp);
    const now = new Date();
    const hoursDiff = (now - articleDate) / (1000 * 60 * 60);
    
    let dateMatch = true;
    if (AppState.filters.dateRange === '24h') dateMatch = hoursDiff <= 24;
    else if (AppState.filters.dateRange === '7d') dateMatch = hoursDiff <= 168;
    else if (AppState.filters.dateRange === '30d') dateMatch = hoursDiff <= 720;
    
    // Source filter
    const sourceMatch = AppState.filters.source === 'all' || 
      article.source.toLowerCase().includes(AppState.filters.source.toLowerCase());
    
    // Sentiment filter
    const sentiment = article.sentiment_ensemble;
    let sentimentMatch = false;
    if (AppState.filters.sentiment.positive && sentiment > 0.2) sentimentMatch = true;
    if (AppState.filters.sentiment.negative && sentiment < -0.2) sentimentMatch = true;
    if (AppState.filters.sentiment.neutral && Math.abs(sentiment) <= 0.2) sentimentMatch = true;
    
    // Search filter
    const searchMatch = !AppState.filters.search || 
      article.headline.toLowerCase().includes(AppState.filters.search) ||
      article.entities.some(e => e.toLowerCase().includes(AppState.filters.search));
    
    return dateMatch && sourceMatch && sentimentMatch && searchMatch;
  });
}

function applyFilters() {
  renderDashboard();
  if (AppState.currentView === 'analytics') {
    renderAnalytics();
  }
}

function calculateEntitySentiment(entityName) {
  const entityArticles = AppState.articles.filter(a => 
    a.entities.some(e => e.toLowerCase() === entityName.toLowerCase())
  );
  
  if (entityArticles.length === 0) return 0;
  
  const avgSentiment = entityArticles.reduce((sum, a) => sum + a.sentiment_ensemble, 0) / entityArticles.length;
  return parseFloat(avgSentiment.toFixed(2));
}

function countEntityMentions(entityName) {
  return AppState.articles.filter(a => 
    a.entities.some(e => e.toLowerCase() === entityName.toLowerCase())
  ).length;
}

function getSentimentColor(sentiment) {
  if (sentiment > 0.2) return '#4caf50';
  if (sentiment < -0.2) return '#f44336';
  return '#ffc107';
}

function filterByEntity(entityName) {
  AppState.filters.search = entityName.toLowerCase();
  document.getElementById('searchInput').value = entityName;
  applyFilters();
  showToast(`Filtered by ${entityName}`, 'info');
}

function showCountryDetails(countryName) {
  const countryArticles = AppState.articles.filter(a => a.country === countryName);
  showToast(`${countryName}: ${countryArticles.length} articles`, 'info');
}

function showArticleModal(article) {
  document.getElementById('modalHeadline').textContent = article.headline;
  document.getElementById('modalSource').textContent = article.source;
  document.getElementById('modalTimestamp').textContent = formatTimestamp(article.timestamp);
  document.getElementById('modalVaderScore').textContent = article.sentiment_vader.toFixed(2);
  document.getElementById('modalBertScore').textContent = article.sentiment_bert.toFixed(2);
  document.getElementById('modalEnsembleScore').textContent = article.sentiment_ensemble.toFixed(2);
  document.getElementById('modalEntities').innerHTML = article.entities.map(e => 
    `<span class="tag">${e}</span>`
  ).join('');
  document.getElementById('modalContent').textContent = article.content;
  
  document.getElementById('articleModal').classList.add('active');
}

function closeModal() {
  document.getElementById('articleModal').classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours < 24) return `${hours} hours ago`;
  return `${days} days ago`;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Real-time Updates
function startRealTimeUpdates() {
  // Update every 5 seconds
  AppState.refreshInterval = setInterval(() => {
    // Generate new article
    const newArticle = DataGenerator.generateArticle(0);
    AppState.articles.unshift(newArticle);
    
    // Keep only last 200 articles
    if (AppState.articles.length > 200) {
      AppState.articles = AppState.articles.slice(0, 200);
    }
    
    // Update entity data
    newArticle.entities.forEach(entityName => {
      const entity = AppState.entities.find(e => e.name === entityName);
      if (entity) {
        entity.mentions++;
        entity.sentiment = calculateEntitySentiment(entityName);
      } else {
        AppState.entities.push({
          name: entityName,
          sentiment: newArticle.sentiment_ensemble,
          mentions: 1
        });
      }
    });
    
    // Update watchlist
    AppState.watchlist.forEach(item => {
      item.sentiment = calculateEntitySentiment(item.name);
    });
    
    // Update current view
    if (AppState.currentView === 'dashboard') {
      updateOverviewCards();
      updateSentimentTrendData();
      renderTopEntities();
    }
    
    // Random chance to trigger alert
    if (Math.random() < 0.1 && AppState.watchlist.length > 0) {
      const randomItem = AppState.watchlist[Math.floor(Math.random() * AppState.watchlist.length)];
      if (randomItem.alertEnabled) {
        const newAlert = {
          entity: randomItem.name,
          type: 'Sentiment Spike',
          threshold: 30,
          timestamp: new Date().toISOString(),
          priority: 'emerging',
          change: Math.floor(Math.random() * 30) + 20,
          status: 'active'
        };
        AppState.alerts.unshift(newAlert);
        if (AppState.currentView === 'alerts') {
          renderActiveAlerts();
        }
        updateWatchlistStats();
        showToast(`New alert: ${randomItem.name}`, 'warning');
      }
    }
  }, 5000);
}

function updateSentimentTrendData() {
  if (AppState.charts.sentimentTrend) {
    // Add new data point
    const chart = AppState.charts.sentimentTrend;
    const newTime = new Date().getHours() + ':00';
    
    // Shift old data
    chart.data.labels.shift();
    chart.data.labels.push(newTime);
    
    chart.data.datasets.forEach(dataset => {
      dataset.data.shift();
      const lastValue = dataset.data[dataset.data.length - 1];
      const newValue = lastValue + (Math.random() - 0.5) * 0.1;
      dataset.data.push(newValue);
    });
    
    chart.update('none');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}