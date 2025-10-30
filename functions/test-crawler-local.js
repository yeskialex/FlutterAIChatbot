#!/usr/bin/env node

// Test the crawler locally without deploying
const admin = require('firebase-admin');

// Initialize Firebase Admin with your service account
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'hi-project-flutter-chatbot'
  });
}

// Import crawler function components
const { runCrawler } = require('./runCrawler');

console.log('🕷️ Testing Crawler Locally...\n');

async function testCrawler() {
  try {
    // Create mock request/response objects
    const req = {
      method: 'POST',
      body: {
        limit: 5 // Start with just 5 pages for testing
      }
    };

    const res = {
      json: (data) => {
        console.log('✅ Crawler Response:');
        console.log(JSON.stringify(data, null, 2));
      },
      status: (code) => ({
        json: (data) => {
          console.log(`❌ Error (${code}):`);
          console.log(JSON.stringify(data, null, 2));
        }
      })
    };

    console.log('Starting crawler with 5 page limit...');
    console.log('This may take 2-5 minutes...\n');

    // Run the crawler
    await runCrawler.handler(req, res);

  } catch (error) {
    console.error('❌ Local crawler test failed:', error);
  }
}

// Run the test
testCrawler();