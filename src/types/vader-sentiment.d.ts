declare module 'vader-sentiment' {
  export interface VaderResult {
    score: number;
    comparative: number;
    tokens: string[];
    words: string[];
    positive: number[];
    negative: number[];
    positiveScore: number;
    negativeScore: number;
    neutralScore: number;
    compound: number;
  }

  export class SentimentIntensityAnalyzer {
    polarityScores(text: string): VaderResult;
  }

  const VaderSentiment: {
    SentimentIntensityAnalyzer: typeof SentimentIntensityAnalyzer;
  };

  export default VaderSentiment;
}
