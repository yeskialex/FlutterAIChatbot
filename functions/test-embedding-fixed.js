#!/usr/bin/env node

// Test the fixed embedding function
const { generateEmbedding } = require('./rag');

async function testFixedEmbedding() {
  try {
    console.log('🧪 Testing fixed embedding function...\n');

    const testText = 'Flutter is a UI toolkit for building beautiful applications.';
    console.log('Input text:', testText);
    console.log('Text length:', testText.length);

    console.log('\n📊 Generating embedding...');
    const embedding = await generateEmbedding(testText);

    console.log('✅ Embedding generated successfully!');
    console.log('Embedding length:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    console.log('Last 5 values:', embedding.slice(-5));

    // Verify it's a valid embedding
    if (Array.isArray(embedding) && embedding.length > 0 && typeof embedding[0] === 'number') {
      console.log('\n🎉 Embedding is valid!');
      return true;
    } else {
      console.log('\n❌ Invalid embedding format');
      return false;
    }

  } catch (error) {
    console.error('❌ Embedding test failed:', error.message);
    return false;
  }
}

testFixedEmbedding()
  .then(success => {
    if (success) {
      console.log('\n✅ Ready to run crawler with embeddings!');
    } else {
      console.log('\n❌ Fix embedding issues before running crawler');
    }
  });