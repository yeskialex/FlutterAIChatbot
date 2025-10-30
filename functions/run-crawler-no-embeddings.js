#!/usr/bin/env node

// Simplified crawler that works WITHOUT embeddings - just collects and stores content
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const { onRequest } = require("firebase-functions/https");

// Don't initialize here - it's already initialized in index.js

async function runCrawlerNoEmbeddings(limit = 5) {
  try {
    console.log(`🕷️ Starting Content-Only Crawler (${limit} pages)...\n`);

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
          !loc.includes('index.html.md')) {
        urls.push({ url: loc, lastModified: lastmod });
      }
    });

    console.log(`Found ${urls.length} URLs, processing first ${limit}...`);

    // Step 2: Process pages and store in Firestore
    const db = admin.firestore();
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

        // Extract main content
        const title = page$('title').text() || page$('h1').first().text();
        const content = page$('main').text() || page$('article').text() || page$('body').text();

        // Clean content
        const cleanContent = content
          .replace(/\\s+/g, ' ')
          .replace(/\\n+/g, ' ')
          .trim()
          .substring(0, 8000);

        if (cleanContent.length < 100) {
          console.log(`  ⚠️  Skipped: Content too short (${cleanContent.length} chars)`);
          continue;
        }

        console.log(`  ✅ Extracted: ${cleanContent.length} characters`);
        console.log(`  📄 Title: ${title}`);

        // Store in Firestore (without embeddings for now)
        const document = {
          id: `doc_${Date.now()}_${i}`,
          url: url,
          title: title,
          content: cleanContent,
          lastModified: lastModified,
          crawledAt: new Date().toISOString(),
          source: 'flutter_docs',
          hasEmbedding: false  // Flag to indicate no embedding yet
        };

        // Save to Firestore collection 'crawled_documents'
        await db.collection('crawled_documents').doc(document.id).set(document);
        console.log(`  💾 Saved to Firestore: ${document.id}`);

        results.push(document);

      } catch (pageError) {
        console.log(`  ❌ Failed: ${pageError.message}`);
      }
    }

    console.log(`\\n3. Successfully processed and stored ${results.length} documents in Firestore`);
    console.log('\\n📋 Documents stored in collection: crawled_documents');
    console.log('💡 Next step: Fix embedding API and add embeddings to these documents');

    return results;

  } catch (error) {
    console.error('❌ Crawler failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;
  runCrawlerNoEmbeddings(limit)
    .then(results => {
      console.log(`\\n🎉 SUCCESS: ${results.length} documents crawled and stored!`);
      console.log('\\n🔗 Check Firebase Console → Firestore → crawled_documents');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    });
}

// Export as Cloud Function
exports.runCrawlerNoEmbeddings = onRequest({ cors: true }, async (req, res) => {
  try {
    const { limit = 3 } = req.body;

    console.log(`Starting content-only crawler with limit: ${limit}`);
    const results = await runCrawlerNoEmbeddings(limit);

    res.json({
      success: true,
      message: `Crawler completed successfully`,
      results: {
        processed: results.length,
        documents: results.slice(0, 3) // Show first 3 for brevity
      }
    });

  } catch (error) {
    console.error('Crawler error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { runCrawlerNoEmbeddings };