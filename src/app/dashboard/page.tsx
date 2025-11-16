import SentimentDashboard from '@/components/SentimentDashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <SentimentDashboard />
      </main>
    </div>
  );
}
