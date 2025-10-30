#!/usr/bin/env node

const axios = require('axios');

// Test configuration
const LOCAL_BASE_URL = 'http://127.0.0.1:5001/hi-project-flutter-chatbot/us-central1';
const PROD_BASE_URL = 'https://us-central1-hi-project-flutter-chatbot.cloudfunctions.net';

// Choose which environment to test
const BASE_URL = process.argv[2] === 'prod' ? PROD_BASE_URL : LOCAL_BASE_URL;

console.log(`Testing functions at: ${BASE_URL}\n`);

async function testFunction(functionName, method = 'GET', data = null) {
  try {
    const url = `${BASE_URL}/${functionName}`;
    console.log(`🧪 Testing ${functionName}...`);

    const config = {
      method,
      url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ ${functionName} SUCCESS`);
    console.log(`Response:`, response.data);
    console.log('---\n');

  } catch (error) {
    console.log(`❌ ${functionName} FAILED`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Response:`, error.response.data);
    } else {
      console.log(`Error: ${error.message}`);
    }
    console.log('---\n');
  }
}

async function runTests() {
  console.log('🚀 Starting function tests...\n');

  // Test 1: Simple hello world
  await testFunction('helloWorld');

  // Test 2: Firestore test
  await testFunction('testFirestore');

  // Test 3: Simple test
  await testFunction('simpleTest');

  // Test 4: Mock RAG with question
  await testFunction('mockRAG', 'POST', {
    question: 'How do I create a Flutter app?'
  });

  // Test 5: Mock RAG with conversation
  await testFunction('mockRAG', 'POST', {
    question: 'What are Flutter widgets?',
    conversationId: 'test-conversation-123'
  });

  // Test 6: Mock history (GET with query param)
  await testFunction('mockHistory?conversationId=test-conversation-123', 'GET');

  // Test 7: Real generateAnswer function
  await testFunction('generateAnswer', 'POST', {
    question: 'How do I create a Flutter button?'
  });

  // Test 8: Real getHistory function
  await testFunction('getHistory?conversationId=test-conversation-123', 'GET');

  // Test 9: runCrawler function (be careful - this might take time and cost money)
  console.log('⚠️  Skipping runCrawler test - it fetches real data and may be expensive');
  // await testFunction('runCrawler', 'POST');

  console.log('🏁 All tests completed!');
}

runTests().catch(console.error);