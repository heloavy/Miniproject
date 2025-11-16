// scripts/test-sentiment.ts
import { analyzeSentiment } from '../src/lib/sentiment/fusion';
import { analyze as vaderAnalyze } from '../src/lib/sentiment/vader';
import { analyze as transformerAnalyze } from '../src/lib/sentiment/transformer';

async function testSentiment() {
  const testTexts = [
    'I love this product! It works great and I am very happy with it.',
    'This is terrible. I am very disappointed with the quality.',
    'The product is okay, but could be better for the price.',
    'I feel neutral about this. It does what it says but nothing special.'
  ];

  console.log('🚀 Testing sentiment analysis with weighted fusion (40% VADER, 60% BERT)...\n');

  for (const text of testTexts) {
    try {
      console.log('📝 Text:', text);
      
      // Get individual scores for comparison
      const [vaderResult, transformerResult] = await Promise.all([
        vaderAnalyze(text),
        transformerAnalyze(text)
      ]);
      
      // Get the fused result
      const result = await analyzeSentiment(text);
      
      console.log('📊 Individual Scores:');
      console.log(`- VADER: ${vaderResult.compound.toFixed(4)}`);
      console.log(`- BERT:  ${transformerResult.score.toFixed(4)}`);
      
      console.log('\n🎯 Fused Score (40% VADER, 60% BERT):');
      console.log(`- Final Score: ${result.finalScore.toFixed(4)} (${result.sentiment.toUpperCase()})`);
      
      console.log('---\n');
    } catch (error) {
      console.error('❌ Error analyzing text:', error);
    }
  }

  console.log('✅ Sentiment analysis test completed!');
  process.exit(0);
}

testSentiment().catch(console.error);
