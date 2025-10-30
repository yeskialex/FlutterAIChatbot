#!/usr/bin/env node

// Test embedding generation with different API formats
const { VertexAI } = require('@google-cloud/vertexai');

const vertex_ai = new VertexAI({
  project: 'hi-project-flutter-chatbot',
  location: 'us-central1'
});

async function testEmbedding() {
  try {
    console.log('🧪 Testing different embedding API formats...\n');

    const testText = 'Flutter is a UI toolkit for building applications.';

    // Try format 1: textEmbedding model
    try {
      console.log('1. Testing text-embedding-004 model...');
      const model = vertex_ai.getGenerativeModel({
        model: 'text-embedding-004'
      });

      const result = await model.embedContent(testText);
      console.log('✅ Format 1 works!');
      console.log('Response structure:', Object.keys(result.response || {}));
      return result.response.embeddings.values;
    } catch (error) {
      console.log('❌ Format 1 failed:', error.message);
    }

    // Try format 2: Different method
    try {
      console.log('2. Testing textembedding-gecko model...');
      const model = vertex_ai.getGenerativeModel({
        model: 'textembedding-gecko'
      });

      const result = await model.embedContent(testText);
      console.log('✅ Format 2 works!');
      return result.response.embeddings.values;
    } catch (error) {
      console.log('❌ Format 2 failed:', error.message);
    }

    console.log('❌ All formats failed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmbedding();