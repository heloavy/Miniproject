# Advanced Sentiment Analytics Platform
This project is a comprehensive sentiment analysis dashboard, purpose-built for Small and Medium-sized Enterprises (SMEs). Developed using Next.js, the platform harnesses advanced AI models to deliver real-time insights into market trends, brand perception, and global sentiment. By integrating robust backend services through Supabase and high-performance AI inferences via Groq, This project transforms raw data from social platforms (Reddit, Twitter/X) and news sources into actionable business intelligence.
## 🚀 Key Features
### 📊 Advanced Sentiment Analytics
- **Multi-Model Analysis:** Utilizes three distinct AI models—Fusion, VADER, and DistilBERT—for consensus-driven, high-accuracy sentiment scoring.
- **Real-Time Trends:** Dynamic charts and visualizations display live sentiment shifts.

### 🌍 Geographic & Entity Intelligence
- **Regional Breakdown:** Offers detailed sentiment reports across global markets such as Global, India, China, Indonesia, Canada, and Brazil.
- **Trending Entities:** Dedicated tracking for high-impact topics and organizations (e.g., AI, US, Nvidia, Google, China, OpenAI).

### 🤖 AI-Powered Assistance
- **AI Sentiment Assistant:** Integrated chatbot to answer queries about trends and provide instant data analysis.

### 🔍 Granular Control
- **Comprehensive Filtering:** Refine data by date range, source (Reddit, News, etc.), and sentiment type to isolate specific metrics.

## 🛠️ Technology Stack
- **Frontend:** Next.js (App Router), Tailwind CSS, Geist Font
- **Backend & Auth:** Supabase
- **AI & Inference:** Groq API
- **Data Sources:** Reddit, News API, Twitter/X

## ⚙️ Environment Configuration
Create the environment file:
```bash
cp .env.example .env.local
```
Set the following variables in `.env.local`:

| Variable                     | Description                                     |
| ----------------------------|------------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL     | Your Supabase Project URL.                      |
| NEXT_PUBLIC_SUPABASE_ANON_KEY| Your Supabase Anonymous Public Key.            |
| NEWS_API_KEY                 | API key from NewsAPI.org                        |
| TWITTER_BEARER_TOKEN         | Bearer Token from X (Twitter) Developer Portal |
| GROQ_API_KEY                 | API Key for Groq AI inference                   |

Example:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
NEWS_API_KEY=your-news-api-key
TWITTER_BEARER_TOKEN=your-twitter-token
GROQ_API_KEY=your-groq-key
```
## 💻 Getting Started
Clone the repository:
```bash
git clone  https://github.com/heloavy/Miniproject.git
cd Miniproject
```
Install dependencies:
```bash
npm install
or
yarn install
or
pnpm install
or
bun install
```
Run the development server:
```bash
npm run dev:with-collector
```

Access the Dashboard at: [http://localhost:3001](http://localhost:3001)
## 📸 Snapshots
- # Dashboard
  <img width="1908" height="935" alt="image" src="https://github.com/user-attachments/assets/d852efeb-f732-4594-b32b-01aeccd37fe2" />
- # Analytics
  <img width="1904" height="939" alt="image" src="https://github.com/user-attachments/assets/ba02f629-f3d7-4398-addf-e1f3b32b5a02" />
- # Chatbot
  <img width="687" height="945" alt="image" src="https://github.com/user-attachments/assets/0d81f11c-87b9-4ea3-8036-8aaa72c721b5" />

## 📚 Documentation & Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Groq AI Documentation](https://console.groq.com/docs/quickstart)
---
© 2025 This project Analytics. All Rights Reserved.
