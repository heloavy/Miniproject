// Import the vader-sentiment library
const vader = require('vader-sentiment');

export interface VaderResult {
  score: number;
  compound: number;
  positive: number;
  negative: number;
  neutral: number;
}

export async function analyze(text: string): Promise<VaderResult> {
  try {
    // Use the intensity method from vader-sentiment
    const result = vader.SentimentIntensityAnalyzer.polarity_scores(text);
    
    return {
      score: result.compound,
      compound: result.compound,
      positive: result.pos,
      negative: result.neg,
      neutral: result.neu
    };
  } catch (error) {
    console.error('Error in VADER analysis:', error);
    // Return neutral sentiment in case of error
    return {
      score: 0,
      compound: 0,
      positive: 0,
      negative: 0,
      neutral: 1
    };
  }
}

export { analyze as analyzeWithVader }; // Keep for backward compatibility
