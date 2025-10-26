const { onRequest } = require("firebase-functions/https");
const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');

/**
 * Simple test crawler to verify basic functionality
 */
exports.testCrawler = onRequest({ cors: true }, async (req, res) => {
  try {
    console.log('Starting simple crawler test...');

    // Test 1: Fetch sitemap
    const sitemapResponse = await axios.get('https://docs.flutter.dev/sitemap.xml', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Flutter-Chatbot-Crawler/1.0'
      }
    });

    const $ = cheerio.load(sitemapResponse.data, { xmlMode: true });
    const urls = [];

    $('url').each((index, element) => {
      const loc = $(element).find('loc').text();
      if (loc.includes('docs.flutter.dev') &&
          !loc.includes('.xml') &&
          !loc.includes('.jpg') &&
          !loc.includes('.png')) {
        urls.push(loc);
      }
    });

    console.log(`Found ${urls.length} URLs in sitemap`);

    // Test 2: Fetch one simple page
    const testUrl = 'https://docs.flutter.dev/get-started/install';
    console.log(`Testing fetch of: ${testUrl}`);

    const pageResponse = await axios.get(testUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Flutter-Chatbot-Crawler/1.0'
      }
    });

    const page$ = cheerio.load(pageResponse.data);
    const title = page$('h1').first().text() || page$('title').text() || 'Unknown';
    const content = page$('main').text() || page$('.content').text() || 'No content found';

    // Test 3: Save to Firestore
    const db = admin.firestore();
    const testDoc = {
      url: testUrl,
      title: title.trim(),
      contentLength: content.length,
      scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      testRun: true
    };

    await db.collection('test_crawl').add(testDoc);

    res.json({
      success: true,
      message: 'Crawler test completed successfully',
      results: {
        sitemapUrls: urls.length,
        testPage: {
          url: testUrl,
          title: title.trim(),
          contentLength: content.length
        }
      }
    });

  } catch (error) {
    console.error('Crawler test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});