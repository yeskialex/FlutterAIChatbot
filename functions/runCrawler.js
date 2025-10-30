const { onRequest } = require("firebase-functions/https");
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const cheerio = require('cheerio');
const axios = require('axios');
const admin = require('firebase-admin');
const { classifyContent } = require('./llm');
const { addDocumentsToIndex } = require('./rag');

/**
 * Fetch and parse Flutter docs sitemap
 * @returns {Promise<Array>} Array of URLs from sitemap
 */
async function fetchSitemap() {
  try {
    console.log('Fetching Flutter docs sitemap...');

    const response = await axios.get('https://docs.flutter.dev/sitemap.xml', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Flutter-Chatbot-Crawler/1.0'
      }
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const urls = [];

    $('url').each((index, element) => {
      const loc = $(element).find('loc').text();
      const lastmod = $(element).find('lastmod').text();

      // Filter for main documentation pages (exclude assets, images, etc.)
      if (loc.includes('docs.flutter.dev') &&
          !loc.includes('.xml') &&
          !loc.includes('.jpg') &&
          !loc.includes('.png') &&
          !loc.includes('/assets/')) {

        urls.push({
          url: loc,
          lastModified: lastmod || new Date().toISOString()
        });
      }
    });

    console.log(`Found ${urls.length} documentation URLs in sitemap`);
    return urls;

  } catch (error) {
    console.error('Error fetching sitemap:', error);
    throw error;
  }
}

/**
 * Scrape content from a single documentation page
 * @param {string} url - URL to scrape
 * @returns {Promise<Object>} Scraped content data
 */
async function scrapePage(url) {
  let browser;

  try {
    console.log(`Scraping: ${url}`);

    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // Set user agent and viewport
    await page.setUserAgent('Flutter-Chatbot-Crawler/1.0');
    await page.setViewport({ width: 1200, height: 800 });

    // Navigate to page with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for main content to load
    await page.waitForSelector('main, .content, article', { timeout: 10000 });

    // Extract content using page.evaluate
    const pageData = await page.evaluate(() => {
      // Get page title
      const title = document.querySelector('h1')?.textContent?.trim() ||
                   document.title?.trim() ||
                   'Flutter Documentation';

      // Get main content (try different selectors)
      const contentSelectors = [
        'main .content',
        'main',
        '.content',
        'article',
        '.markdown-body',
        '#content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Remove navigation, sidebar, and other non-content elements
          const clonedElement = element.cloneNode(true);

          // Remove unwanted elements
          const unwantedSelectors = [
            'nav', '.nav', '.navigation',
            '.sidebar', '.toc', '.table-of-contents',
            '.breadcrumbs', '.breadcrumb',
            'footer', '.footer',
            '.social-share', '.share-buttons',
            'script', 'style', 'noscript'
          ];

          unwantedSelectors.forEach(sel => {
            clonedElement.querySelectorAll(sel).forEach(el => el.remove());
          });

          mainContent = clonedElement.textContent || clonedElement.innerText || '';
          break;
        }
      }

      // Get code examples
      const codeBlocks = [];
      document.querySelectorAll('pre code, .highlight code, .code-block').forEach((block, index) => {
        const code = block.textContent?.trim();
        if (code && code.length > 10) {
          codeBlocks.push({
            id: `code_${index}`,
            content: code,
            language: block.className?.match(/language-(\w+)/)?.[1] || 'dart'
          });
        }
      });

      return {
        title: title,
        content: mainContent.trim(),
        codeBlocks: codeBlocks,
        wordCount: mainContent.trim().split(/\s+/).length
      };
    });

    // Clean and validate content
    if (!pageData.content || pageData.content.length < 100) {
      throw new Error('Insufficient content extracted');
    }

    return {
      url: url,
      title: pageData.title,
      content: pageData.content,
      codeBlocks: pageData.codeBlocks,
      wordCount: pageData.wordCount,
      scrapedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Process and chunk document content
 * @param {Object} pageData - Scraped page data
 * @returns {Promise<Array>} Array of document chunks
 */
async function processDocument(pageData) {
  try {
    const chunks = [];
    const { url, title, content, codeBlocks } = pageData;

    // Chunk content into manageable pieces (1000-1500 tokens)
    const maxChunkSize = 1200; // chars (roughly 300 tokens)
    const overlapSize = 200;

    // Split content by paragraphs first
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        const chunkId = `${url.split('/').pop()}_chunk_${chunkIndex}`;
        const contentType = await classifyContent(currentChunk);

        chunks.push({
          id: chunkId,
          url: url,
          title: title,
          content: currentChunk.trim(),
          contentType: contentType,
          chunkIndex: chunkIndex,
          lastUpdated: pageData.scrapedAt,
          metadata: {
            title: title,
            url: url,
            section: title,
            type: contentType,
            wordCount: currentChunk.trim().split(/\s+/).length
          }
        });

        // Start new chunk with overlap
        const words = currentChunk.trim().split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlapSize / 5)); // rough word count
        currentChunk = overlapWords.join(' ') + ' ' + paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 100) {
      const chunkId = `${url.split('/').pop()}_chunk_${chunkIndex}`;
      const contentType = await classifyContent(currentChunk);

      chunks.push({
        id: chunkId,
        url: url,
        title: title,
        content: currentChunk.trim(),
        contentType: contentType,
        chunkIndex: chunkIndex,
        lastUpdated: pageData.scrapedAt,
        metadata: {
          title: title,
          url: url,
          section: title,
          type: contentType,
          wordCount: currentChunk.trim().split(/\s+/).length
        }
      });
    }

    // Add code blocks as separate chunks
    for (const codeBlock of codeBlocks) {
      const codeChunkId = `${url.split('/').pop()}_${codeBlock.id}`;
      chunks.push({
        id: codeChunkId,
        url: url,
        title: `${title} - Code Example`,
        content: `Code example from ${title}:\n\n\`\`\`${codeBlock.language}\n${codeBlock.content}\n\`\`\``,
        contentType: 'code',
        chunkIndex: -1,
        lastUpdated: pageData.scrapedAt,
        metadata: {
          title: title,
          url: url,
          section: 'Code Examples',
          type: 'code',
          language: codeBlock.language,
          wordCount: codeBlock.content.split(/\s+/).length
        }
      });
    }

    console.log(`Created ${chunks.length} chunks for ${title}`);
    return chunks;

  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

/**
 * Cloud Function to run the crawler
 */
exports.runCrawler = onRequest({
  cors: true,
  timeoutSeconds: 900,
  memory: '4GiB'
}, async (req, res) => {
  try {
    const { testMode = true, maxPages = 1 } = req.body || {};

    console.log(`Starting crawler (testMode: ${testMode}, maxPages: ${maxPages})`);

    // Fetch sitemap URLs
    const sitemapUrls = await fetchSitemap();

    // Filter URLs for testing (prioritize main sections)
    const priorityUrls = sitemapUrls.filter(item =>
      item.url.includes('/development/') ||
      item.url.includes('/cookbook/') ||
      item.url.includes('/ui/') ||
      item.url.includes('/testing/')
    );

    const urlsToProcess = testMode
      ? priorityUrls.slice(0, maxPages)
      : sitemapUrls;

    console.log(`Processing ${urlsToProcess.length} URLs`);

    const results = {
      processed: 0,
      failed: 0,
      totalChunks: 0,
      urls: []
    };

    // Process each URL
    for (const urlData of urlsToProcess) {
      try {
        // Scrape page content
        const pageData = await scrapePage(urlData.url);

        // Process and chunk content
        const chunks = await processDocument(pageData);

        // Store chunks in Firestore for now (vector index not ready yet)
        const db = admin.firestore();
        const batch = db.batch();

        chunks.forEach(chunk => {
          const docRef = db.collection('document_chunks').doc(chunk.id);
          batch.set(docRef, {
            ...chunk,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        await batch.commit();

        // Add chunks to vector index for semantic search
        try {
          const vectorDocs = chunks.map(chunk => ({
            id: chunk.id,
            text: chunk.content,
            metadata: {
              url: chunk.url,
              title: chunk.title,
              contentType: chunk.contentType,
              lastUpdated: chunk.lastUpdated
            }
          }));

          const vectorResult = await addDocumentsToIndex(vectorDocs);
          console.log(`Added ${vectorDocs.length} documents to vector index: ${vectorResult.fileName}`);
        } catch (vectorError) {
          console.error('Error adding to vector index:', vectorError);
          // Continue processing even if vector indexing fails
        }

        results.processed++;
        results.totalChunks += chunks.length;
        results.urls.push({
          url: urlData.url,
          status: 'success',
          chunks: chunks.length,
          title: pageData.title
        });

        console.log(`✓ Processed: ${pageData.title} (${chunks.length} chunks)`);

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`✗ Failed to process ${urlData.url}:`, error.message);
        results.failed++;
        results.urls.push({
          url: urlData.url,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Crawler completed',
      results: results,
      testMode: testMode
    });

  } catch (error) {
    console.error('Crawler error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});