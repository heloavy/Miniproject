import { NextRequest, NextResponse } from 'next/server';
import { supabase as supabaseClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days') || '7');

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get geographic sentiment data
        const { data, error } = await supabaseClient
            .from('articles')
            .select(`
        country,
        region,
        sentiment_scores (
          final_score,
          vader_compound,
          transformer_score
        )
      `)
            .gte('published_at', startDate.toISOString())
            .not('country', 'is', null);

        if (error) {
            console.error('Error fetching geographic data:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Aggregate by country
        const countryMap = new Map<string, {
            country: string;
            articleCount: number;
            avgSentiment: number;
            positiveCount: number;
            negativeCount: number;
            neutralCount: number;
            sentimentSum: number;
        }>();

        data?.forEach((article: any) => {
            const country = article.country || 'Global';
            const score = article.sentiment_scores?.final_score || 0;

            const entry = countryMap.get(country) || {
                country,
                articleCount: 0,
                avgSentiment: 0,
                positiveCount: 0,
                negativeCount: 0,
                neutralCount: 0,
                sentimentSum: 0
            };

            entry.articleCount += 1;
            entry.sentimentSum += score;

            if (score > 0.2) entry.positiveCount += 1;
            else if (score < -0.2) entry.negativeCount += 1;
            else entry.neutralCount += 1;

            countryMap.set(country, entry);
        });

        // Calculate averages and format response
        const geographicData = Array.from(countryMap.values())
            .map(entry => ({
                country: entry.country,
                articleCount: entry.articleCount,
                avgSentiment: entry.articleCount > 0 ? entry.sentimentSum / entry.articleCount : 0,
                positivePercent: entry.articleCount > 0 ? Math.round((entry.positiveCount / entry.articleCount) * 100) : 0,
                negativePercent: entry.articleCount > 0 ? Math.round((entry.negativeCount / entry.articleCount) * 100) : 0,
                neutralPercent: entry.articleCount > 0 ? Math.round((entry.neutralCount / entry.articleCount) * 100) : 0,
                positiveCount: entry.positiveCount,
                negativeCount: entry.negativeCount,
                neutralCount: entry.neutralCount
            }))
            .sort((a, b) => b.articleCount - a.articleCount);

        return NextResponse.json({
            data: geographicData,
            meta: {
                totalCountries: geographicData.length,
                totalArticles: data?.length || 0,
                dateRange: `${days} days`
            }
        });

    } catch (error: any) {
        console.error('Geographic API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
