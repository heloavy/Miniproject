// src/lib/sentiment/fusion.ts
import { analyze as vaderAnalyze, VaderResult } from './vader';
import { analyze as transformerAnalyze } from './transformer';

// Cache for storing sentiment results
const sentimentCache = new Map<string, { score: number; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours cache

export async function analyzeSentiment(text: string, useCache = true) {
  // Generate a cache key (simple hash of the text)
  const cacheKey = text.trim().toLowerCase();
  
  // Check cache first if enabled
  if (useCache) {
    const cached = sentimentCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      const score = cached.score;
      return {
        vader: { score, compound: score, positive: 0, negative: 0, neutral: 0 } as VaderResult,
        transformer: { score },
        finalScore: score,
        sentiment: getSentimentLabel(score),
        confidence: Math.abs(score)
      };
    }
  }

  try {
    // Run both analyses in parallel with error handling
    const [vaderResult, transformerResult] = await Promise.all([
      vaderAnalyze(text).catch(() => ({ 
        score: 0, 
        compound: 0, 
        positive: 0, 
        negative: 0, 
        neutral: 1 
      } as VaderResult)),
      transformerAnalyze(text).catch(() => ({ score: 0 }))
    ]);

    // Dynamic weighting based on text length
    const vaderWeight = Math.min(0.6, 0.4 + (text.length > 100 ? -0.1 : 0));
    const transformerWeight = 1 - vaderWeight;

    // Calculate final score with dynamic weighting
    const finalScore = (vaderResult.compound * vaderWeight) + 
                      (transformerResult.score * transformerWeight);

    // Calculate confidence (higher absolute score = higher confidence)
    const confidence = Math.min(1, Math.abs(finalScore) * 1.2);

    // Cache the result
    if (useCache) {
      sentimentCache.set(cacheKey, {
        score: finalScore,
        timestamp: Date.now()
      });
    }

    return {
      vader: vaderResult,
      transformer: transformerResult,
      finalScore,
      sentiment: getSentimentLabel(finalScore),
      confidence
    };
  } catch (error) {
    console.error('Error in sentiment analysis:', error);
    return {
      vader: { score: 0, compound: 0, positive: 0, negative: 0, neutral: 1 } as VaderResult,
      transformer: { score: 0 },
      finalScore: 0,
      sentiment: 'neutral' as const,
      confidence: 0
    };
  }
}

function getSentimentLabel(score: number): 'positive' | 'negative' | 'neutral' {
  if (Math.abs(score) < 0.1) return 'neutral';
  return score > 0 ? 'positive' : 'negative';
}