#!/usr/bin/env node

// Test crawler using axios instead of puppeteer (simpler, no Chrome needed)
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const { generateEmbedding, addDocumentsToIndex } = require('./rag');
const { classifyContent } = require('./llm');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'hi-project-flutter-chatbot'
  });
}

async function runSimpleCrawler(limit = 3) {
  try {
    console.log(`🕷️ Starting Simple Crawler (${limit} pages)...\n`);

    // Step 1: Get URLs from sitemap
    console.log('1. Fetching sitemap...');
    const sitemapResponse = await axios.get('https://docs.flutter.dev/sitemap.xml', {
      timeout: 10000,
      headers: { 'User-Agent': 'Flutter-Chatbot-Crawler/1.0' }
    });

    const $ = cheerio.load(sitemapResponse.data, { xmlMode: true });
    const urls = [];

    $('url').each((index, element) => {
      const loc = $(element).find('loc').text();
      const lastmod = $(element).find('lastmod').text();

      if (loc.includes('docs.flutter.dev') &&
          !loc.includes('/assets/') &&
          !loc.includes('.png') &&
          !loc.includes('.jpg') &&
          !loc.includes('index.html.md')) { // Skip markdown files
        urls.push({ url: loc, lastModified: lastmod });
      }
    });

    console.log(`Found ${urls.length} URLs, processing first ${limit}...`);

    // Step 2: Process pages
    const results = [];
    for (let i = 0; i < Math.min(limit, urls.length); i++) {
      const { url, lastModified } = urls[i];
      console.log(`\\n2.${i+1} Processing: ${url}`);

      try {
        // Fetch page content
        const pageResponse = await axios.get(url, {
          timeout: 15000,
          headers: { 'User-Agent': 'Flutter-Chatbot-Crawler/1.0' }
        });

        // Parse with cheerio
        const page$ = cheerio.load(pageResponse.data);

        // Extract main content (adjust selectors based on Flutter docs structure)
        const title = page$('title').text() || page$('h1').first().text();
        const content = page$('main').text() || page$('article').text() || page$('body').text();

        // Clean content
        const cleanContent = content
          .replace(/\\s+/g, ' ')
          .replace(/\\n+/g, ' ')
          .trim()
          .substring(0, 8000); // Limit content length

        if (cleanContent.length < 100) {
          console.log(`  ⚠️  Skipped: Content too short (${cleanContent.length} chars)`);
          continue;
        }

        console.log(`  ✅ Extracted: ${cleanContent.length} characters`);
        console.log(`  📄 Title: ${title}`);

        // Create document for vector database
        const document = {
          id: `doc_${Date.now()}_${i}`,
          url: url,
          title: title,
          content: cleanContent,
          lastModified: lastModified,
          crawledAt: new Date().toISOString(),
          source: 'flutter_docs'
        };

        results.push(document);

      } catch (pageError) {
        console.log(`  ❌ Failed: ${pageError.message}`);
      }
    }

    console.log(`\\n3. Successfully processed ${results.length} pages`);

    // Step 3: Generate embeddings and add to vector database
    if (results.length > 0) {
      console.log('\\n4. Adding to vector database...');

      for (const doc of results) {
        try {
          console.log(`  📊 Generating embedding for: ${doc.title}`);
          const embedding = await generateEmbedding(doc.content);

          console.log(`  💾 Adding to vector index...`);
          await addDocumentsToIndex([{
            id: doc.id,
            embedding: embedding,
            metadata: {
              url: doc.url,
              title: doc.title,
              lastModified: doc.lastModified,
              source: doc.source
            }
          }]);

          console.log(`  ✅ Added: ${doc.title}`);
        } catch (embedError) {
          console.log(`  ❌ Embedding failed: ${embedError.message}`);
        }
      }
    }

    console.log(`\\n🎉 Crawler completed! Processed ${results.length} documents.`);
    return results;

  } catch (error) {
    console.error('❌ Crawler failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 3;
  runSimpleCrawler(limit)
    .then(results => {
      console.log(`\\n✅ Final result: ${results.length} documents processed`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runSimpleCrawler };