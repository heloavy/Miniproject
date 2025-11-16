// src/lib/sentiment/transformer.ts
import { pipeline, Pipeline, PipelineType } from '@xenova/transformers';

// Define the shape of our sentiment analysis result
type SentimentResult = {
  label: string;
  score: number;
};

// Define our custom pipeline type
type SentimentPipeline = {
  (text: string, options?: any): Promise<SentimentResult | SentimentResult[]>;
};

// This is a type assertion to tell TypeScript that we know what we're doing
type TextClassificationPipeline = Pipeline & {
  (text: string, options?: any): Promise<SentimentResult | SentimentResult[]>;
};

// Singleton to hold the pipeline instance
let sentimentPipeline: SentimentPipeline | null = null;

/**
 * Lazy-loads and returns the sentiment analysis pipeline.
 * This ensures we only load the (large) model once.
 */
async function getSentimentPipeline(): Promise<SentimentPipeline> {
  if (sentimentPipeline === null) {
    console.log('Initializing sentiment pipeline...');
    try {
      // Load a specific, lightweight model for sentiment analysis
      const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
        quantized: true // Use quantized model for better performance
      }) as unknown as TextClassificationPipeline;
      
      // Create a wrapper function that matches our SentimentPipeline type
      sentimentPipeline = async (text: string) => {
        const result = await classifier(text);
        // Ensure we always return an array of results
        return Array.isArray(result) ? result : [result];
      };
      
      console.log('✅ Sentiment pipeline initialized.');
    } catch (error) {
      console.error('Failed to initialize sentiment pipeline:', error);
      throw error; // Propagate error so the main function can fall back
    }
  }
  return sentimentPipeline;
}

/**
 * A simple word-based sentiment analysis as a fallback.
 */
function analyzeWithFallback(text: string): number {
  try {
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'happy', 'love', 'positive', 'like', 'up', 'gain', 'profit', 'success'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'negative', 'dislike', 'down', 'loss', 'drop', 'fail'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    // Normalize score between -1 and 1
    return Math.max(-1, Math.min(1, score));
  } catch (fallbackError) {
    console.error('Error in fallback analysis:', fallbackError);
    return 0; // Final fallback is neutral
  }
}

/**
 * Analyzes sentiment using a transformer model.
 * If the transformer fails, it uses a simple fallback analysis.
 */
export async function analyzeWithTransformer(text: string): Promise<number> {
  // Ensure text is not empty
  if (!text || text.trim() === '') {
    return 0;
  }

  try {
    // 1. Try to use the real transformer pipeline
    const pipeline = await getSentimentPipeline();
    
    // Truncate text to avoid model limits (512 tokens is common)
    const truncatedText = text.substring(0, 500); // Conservative limit
    
    const results = await pipeline(truncatedText);
    
    // Normalize results to array
    const resultsArray = Array.isArray(results) ? results : [results];
    
    // Get the first result (most likely)
    const result = resultsArray[0];
    if (!result) return 0;
    
    // Map labels to scores (case-insensitive check)
    const label = result.label?.toString().toUpperCase();
    if (label === 'POSITIVE' || label === 'LABEL_1') {
      return result.score; // Positive sentiment
    } else if (label === 'NEGATIVE' || label === 'LABEL_0') {
      return -result.score; // Negative sentiment
    }
    
    return 0; // Neutral or unknown
  } catch (error) {
    // 2. If the pipeline fails, use the simple fallback
    console.error('Error in transformer analysis, using fallback:', error);
    return analyzeWithFallback(text);
  }
}

// Export as default for consistency with other analyzers
export async function analyze(text: string): Promise<{ score: number }> {
  const score = await analyzeWithTransformer(text);
  return { score };
}

export default analyze;