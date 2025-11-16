declare module 'vader-sentiment' {
  export interface VaderResult {
    score: number;
    compound: number;
    positive: number;
    negative: number;
    neutral: number;
  }

  export class SentimentIntensityAnalyzer {
    polarityScores(text: string): VaderResult;
  }
}
