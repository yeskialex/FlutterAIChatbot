#!/usr/bin/env node

// Simple crawler test - just test the sitemap fetching part
const axios = require('axios');
const cheerio = require('cheerio');

async function testSimpleCrawler() {
  try {
    console.log('🕷️ Testing Flutter Docs Sitemap Fetch...\n');

    // Step 1: Fetch sitemap
    console.log('1. Fetching sitemap...');
    const response = await axios.get('https://docs.flutter.dev/sitemap.xml', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Flutter-Chatbot-Crawler/1.0'
      }
    });

    // Step 2: Parse URLs
    console.log('2. Parsing URLs from sitemap...');
    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls = [];

    $('url').each((index, element) => {
      const loc = $(element).find('loc').text();
      const lastmod = $(element).find('lastmod').text();

      // Filter for main documentation pages
      if (loc.includes('docs.flutter.dev') &&
          !loc.includes('/assets/') &&
          !loc.includes('.png') &&
          !loc.includes('.jpg')) {
        urls.push({ url: loc, lastModified: lastmod });
      }
    });

    console.log(`✅ Found ${urls.length} documentation URLs`);
    console.log('\nSample URLs:');
    urls.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i+1}. ${item.url}`);
      console.log(`     Last modified: ${item.lastModified}`);
    });

    console.log('\n🎉 Sitemap test successful! The crawler can access Flutter docs.');

    return urls;

  } catch (error) {
    console.error('❌ Sitemap test failed:', error.message);
    throw error;
  }
}

// Run the test
testSimpleCrawler()
  .then(() => console.log('\n✅ Ready to run full crawler!'))
  .catch(() => console.log('\n❌ Fix sitemap issues before running full crawler'));