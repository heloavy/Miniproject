// A simple sentiment analysis function as a fallback
export async function analyzeWithTransformer(text: string): Promise<number> {
  try {
    // Simple word-based sentiment analysis as a fallback
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'happy', 'love', 'positive', 'like', 'up', 'gain', 'profit'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'negative', 'dislike', 'down', 'loss', 'drop'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    // Normalize score between -1 and 1
    score = Math.max(-1, Math.min(1, score));
    
    return score;
  } catch (error) {
    console.error('Error in transformer analysis:', error);
    return 0; // Return neutral score in case of error
  }
}

// Export as default for consistency with other analyzers
export async function analyze(text: string): Promise<{ score: number }> {
  const score = await analyzeWithTransformer(text);
  return { score };
}

export default analyze;
