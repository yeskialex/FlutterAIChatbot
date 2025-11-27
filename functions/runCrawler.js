const {onRequest} = require("firebase-functions/https");
// Reserved for future browser automation features
// eslint-disable-next-line no-unused-vars
const puppeteer = require("puppeteer-core");
// eslint-disable-next-line no-unused-vars
const chromium = require("@sparticuz/chromium");
const cheerio = require("cheerio");
const axios = require("axios");
const admin = require("firebase-admin");
const {classifyContent} = require("./llm");
const {addDocumentsToIndex} = require("./rag");

/**
 * Fetch and parse Flutter docs sitemap
 * @return {Promise<Array>} Array of URLs from sitemap
 */
async function fetchSitemap() {
  try {
    console.log("Fetching Flutter docs sitemap...");

    const response = await axios.get("https://docs.flutter.dev/sitemap.xml", {
      timeout: 10000,
      headers: {
        "User-Agent": "Flutter-Chatbot-Crawler/1.0",
      },
    });

    const $ = cheerio.load(response.data, {xmlMode: true});
    const urls = [];

    $("url").each((_, element) => {
      const loc = $(element).find("loc").text();
      const lastmod = $(element).find("lastmod").text();

      // Filter for main documentation pages (exclude assets, images, etc.)
      if (loc.includes("docs.flutter.dev") &&
          !loc.includes(".xml") &&
          !loc.includes(".jpg") &&
          !loc.includes(".png") &&
          !loc.includes("/assets/")) {
        urls.push({
          url: loc,
          lastModified: lastmod || new Date().toISOString(),
        });
      }
    });

    console.log(`Found ${urls.length} documentation URLs in sitemap`);
    return urls;
  } catch (error) {
    console.error("Error fetching sitemap:", error);
    throw error;
  }
}

/**
 * Check if URL needs to be re-scraped based on last modified date
 * @param {string} url - URL to check
 * @param {string} lastModified - Last modified date from sitemap
 * @return {Promise<boolean>} True if URL needs to be scraped
 */
async function needsRefresh(url, lastModified) {
  try {
    const db = admin.firestore();
    const statusDoc = await db.collection("crawl_status").doc(encodeURIComponent(url)).get();

    if (!statusDoc.exists) {
      return true; // New URL, needs to be scraped
    }

    const statusData = statusDoc.data();
    const lastScraped = statusData.lastScraped;
    const sitemapLastModified = new Date(lastModified);
    const lastScrapedDate = lastScraped ? lastScraped.toDate() : new Date(0);

    // If sitemap shows content was modified after our last scrape, we need to refresh
    return sitemapLastModified > lastScrapedDate;
  } catch (error) {
    console.error(`Error checking freshness for ${url}:`, error);
    return true; // On error, default to scraping
  }
}

/**
 * Update crawl status in Firestore
 * @param {string} url - URL that was scraped
 * @param {string} lastModified - Last modified date from sitemap
 * @param {boolean} success - Whether scraping was successful
 */
async function updateCrawlStatus(url, lastModified, success) {
  try {
    const db = admin.firestore();
    await db.collection("crawl_status").doc(encodeURIComponent(url)).set({
      url: url,
      lastScraped: admin.firestore.FieldValue.serverTimestamp(),
      sitemapLastModified: new Date(lastModified),
      lastScrapeSuccess: success,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } catch (error) {
    console.error(`Error updating crawl status for ${url}:`, error);
  }
}

/**
 * Scrape content from a single documentation page using Cheerio
 * @param {string} url - URL to scrape
 * @return {Promise<Object>} Scraped content data
 */
async function scrapePage(url) {
  try {
    console.log(`Scraping: ${url}`);

    // Fetch HTML content
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "Flutter-Chatbot-Crawler/1.0",
      },
    });

    const $ = cheerio.load(response.data);

    // Get page title
    const title = $("h1").first().text().trim() ||
                 $("title").text().trim() ||
                 "Flutter Documentation";

    // Get main content (try different selectors)
    const contentSelectors = [
      "main .content",
      "main",
      ".content",
      "article",
      ".markdown-body",
      "#content",
    ];

    let mainContent = "";
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Remove unwanted elements
        element.find("nav, .nav, .navigation").remove();
        element.find(".sidebar, .toc, .table-of-contents").remove();
        element.find(".breadcrumbs, .breadcrumb").remove();
        element.find("footer, .footer").remove();
        element.find(".social-share, .share-buttons").remove();
        element.find("script, style, noscript").remove();

        mainContent = element.text().trim();
        break;
      }
    }

    // Get code examples
    const codeBlocks = [];
    $("pre code, .highlight code, .code-block").each((index, element) => {
      const code = $(element).text().trim();
      if (code && code.length > 10) {
        const className = $(element).attr("class") || "";
        const languageMatch = className.match(/language-(\w+)/);
        codeBlocks.push({
          id: `code_${index}`,
          content: code,
          language: languageMatch ? languageMatch[1] : "dart",
        });
      }
    });

    // Clean and validate content
    if (!mainContent || mainContent.length < 100) {
      throw new Error("Insufficient content extracted");
    }

    const wordCount = mainContent.split(/\s+/).length;

    return {
      url: url,
      title: title,
      content: mainContent,
      codeBlocks: codeBlocks,
      wordCount: wordCount,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    throw error;
  }
}

/**
 * Process and chunk document content
 * @param {Object} pageData - Scraped page data
 * @return {Promise<Array>} Array of document chunks
 */
async function processDocument(pageData) {
  try {
    const chunks = [];
    const {url, title, content, codeBlocks} = pageData;

    // Chunk content into manageable pieces (1000-1500 tokens)
    const maxChunkSize = 1200; // chars (roughly 300 tokens)
    const overlapSize = 200;

    // Split content by paragraphs first
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    let currentChunk = "";
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        // Create chunk
        const chunkId = `${url.split("/").pop()}_chunk_${chunkIndex}`;
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
            wordCount: currentChunk.trim().split(/\s+/).length,
          },
        });

        // Start new chunk with overlap
        const words = currentChunk.trim().split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlapSize / 5)); // rough word count
        currentChunk = overlapWords.join(" ") + " " + paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 100) {
      const chunkId = `${url.split("/").pop()}_chunk_${chunkIndex}`;
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
          wordCount: currentChunk.trim().split(/\s+/).length,
        },
      });
    }

    // Add code blocks as separate chunks
    for (const codeBlock of codeBlocks) {
      const codeChunkId = `${url.split("/").pop()}_${codeBlock.id}`;
      chunks.push({
        id: codeChunkId,
        url: url,
        title: `${title} - Code Example`,
        content: `Code example from ${title}:\n\n\`\`\`${codeBlock.language}\n${codeBlock.content}\n\`\`\``,
        contentType: "code",
        chunkIndex: -1,
        lastUpdated: pageData.scrapedAt,
        metadata: {
          title: title,
          url: url,
          section: "Code Examples",
          type: "code",
          language: codeBlock.language,
          wordCount: codeBlock.content.split(/\s+/).length,
        },
      });
    }

    console.log(`Created ${chunks.length} chunks for ${title}`);
    return chunks;
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

/**
 * Get or create crawl progress tracker
 * @return {Promise<Object>} Progress data
 */
async function getCrawlProgress() {
  try {
    const db = admin.firestore();
    const progressDoc = await db.collection("crawler_metadata").doc("progress").get();

    if (progressDoc.exists) {
      return progressDoc.data();
    }

    // Initialize progress if not exists
    const initialProgress = {
      lastProcessedIndex: -1,
      totalUrls: 0,
      completedUrls: 0,
      failedUrls: 0,
      lastRunAt: null,
      isComplete: false,
    };

    await db.collection("crawler_metadata").doc("progress").set(initialProgress);
    return initialProgress;
  } catch (error) {
    console.error("Error getting crawl progress:", error);
    return {
      lastProcessedIndex: -1,
      totalUrls: 0,
      completedUrls: 0,
      failedUrls: 0,
      lastRunAt: null,
      isComplete: false,
    };
  }
}

/**
 * Update crawl progress
 * @param {Object} updates - Progress updates
 */
async function updateCrawlProgress(updates) {
  try {
    const db = admin.firestore();
    await db.collection("crawler_metadata").doc("progress").update({
      ...updates,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating crawl progress:", error);
  }
}

/**
 * Cloud Function to run the crawler
 */
exports.runCrawler = onRequest({
  cors: true,
  timeoutSeconds: 900,
  memory: "4GiB",
}, async (req, res) => {
  try {
    const {
      testMode = false,
      batchSize = 100,
      resetProgress = false,
    } = req.body || {};

    console.log(`Starting crawler (testMode: ${testMode}, batchSize: ${batchSize})`);

    // Reset progress if requested
    if (resetProgress) {
      console.log("Resetting crawl progress...");
      await updateCrawlProgress({
        lastProcessedIndex: -1,
        completedUrls: 0,
        failedUrls: 0,
        isComplete: false,
      });
    }

    // Get current progress
    const progress = await getCrawlProgress();
    console.log(`Current progress: ${progress.completedUrls}/${progress.totalUrls} URLs completed`);

    // Check if already complete
    if (progress.isComplete && !resetProgress) {
      console.log("Crawl already complete. Use resetProgress: true to start over.");
      return res.json({
        success: true,
        message: "Crawl already complete",
        progress: progress,
      });
    }

    // Fetch sitemap URLs
    const sitemapUrls = await fetchSitemap();
    const totalUrls = sitemapUrls.length;

    // Update total URLs if changed
    if (progress.totalUrls !== totalUrls) {
      await updateCrawlProgress({totalUrls: totalUrls});
    }

    // Calculate batch range
    const startIndex = progress.lastProcessedIndex + 1;
    const endIndex = Math.min(startIndex + batchSize, totalUrls);

    // For test mode, process smaller batch
    const urlsToProcess = testMode ?
      sitemapUrls.slice(0, Math.min(5, totalUrls)) :
      sitemapUrls.slice(startIndex, endIndex);

    console.log(`Processing URLs ${startIndex + 1} to ${endIndex} of ${totalUrls}`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      totalChunks: 0,
      urls: [],
      batchStartIndex: startIndex,
      batchEndIndex: endIndex,
    };

    // Process each URL
    for (let i = 0; i < urlsToProcess.length; i++) {
      const urlData = urlsToProcess[i];
      const currentIndex = testMode ? i : startIndex + i;
      try {
        // Check if page needs refresh based on last modified date
        const needsUpdate = await needsRefresh(urlData.url, urlData.lastModified);

        if (!needsUpdate) {
          console.log(`⏭️  Skipping ${urlData.url} (no changes since last crawl)`);
          results.skipped++;
          results.urls.push({
            url: urlData.url,
            status: "skipped",
            reason: "No changes since last crawl",
          });

          // Update progress for skipped pages (if not in test mode)
          if (!testMode) {
            await updateCrawlProgress({
              lastProcessedIndex: currentIndex,
            });
          }

          continue;
        }

        console.log(`🔄 Processing ${urlData.url} (updated: ${urlData.lastModified})`);

        // Scrape page content
        const pageData = await scrapePage(urlData.url);

        // Process and chunk content
        const chunks = await processDocument(pageData);

        // Add chunks to vector index for semantic search (single source of truth)
        console.log("Starting vector embedding process...");
        try {
          const vectorDocs = chunks.map((chunk) => ({
            id: chunk.id,
            text: chunk.content,
            metadata: {
              url: chunk.url,
              title: chunk.title,
              contentType: chunk.contentType,
              lastUpdated: chunk.lastUpdated,
            },
          }));

          console.log(`Attempting to add ${vectorDocs.length} documents to vector index`);
          const vectorResult = await addDocumentsToIndex(vectorDocs);
          console.log(`SUCCESS: Added ${vectorDocs.length} documents to vector index: ${vectorResult.fileName}`);
        } catch (vectorError) {
          console.error("ERROR adding to vector index:", vectorError);
          console.error("Vector error stack:", vectorError.stack);
          // Continue processing even if vector indexing fails
        }

        // Update crawl status
        await updateCrawlStatus(urlData.url, urlData.lastModified, true);

        results.processed++;
        results.totalChunks += chunks.length;
        results.urls.push({
          url: urlData.url,
          status: "success",
          chunks: chunks.length,
          title: pageData.title,
          lastModified: urlData.lastModified,
        });

        console.log(`✓ Processed: ${pageData.title} (${chunks.length} chunks)`);

        // Update progress after each successful page (if not in test mode)
        if (!testMode) {
          await updateCrawlProgress({
            lastProcessedIndex: currentIndex,
            completedUrls: progress.completedUrls + results.processed,
          });
        }

        // Rate limiting - wait between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`✗ Failed to process ${urlData.url}:`, error.message);

        // Update crawl status even for failed attempts
        await updateCrawlStatus(urlData.url, urlData.lastModified, false);

        results.failed++;
        results.urls.push({
          url: urlData.url,
          status: "failed",
          error: error.message,
          lastModified: urlData.lastModified,
        });

        // Update progress even for failed pages (if not in test mode)
        if (!testMode) {
          await updateCrawlProgress({
            lastProcessedIndex: currentIndex,
            failedUrls: progress.failedUrls + results.failed,
          });
        }
      }
    }

    // Mark as complete if we've processed all URLs
    const finalProgress = await getCrawlProgress();
    const isComplete = !testMode && (finalProgress.lastProcessedIndex >= totalUrls - 1);

    if (isComplete) {
      console.log("🎉 Crawl complete! All pages processed.");
      await updateCrawlProgress({isComplete: true});
    }

    res.json({
      success: true,
      message: isComplete ? "Crawler completed - all pages processed" : "Batch completed",
      results: results,
      progress: {
        completed: finalProgress.completedUrls + results.processed,
        failed: finalProgress.failedUrls + results.failed,
        total: totalUrls,
        percentage: Math.round(((finalProgress.completedUrls + results.processed) / totalUrls) * 100),
        isComplete: isComplete,
        nextBatchStart: isComplete ? null : finalProgress.lastProcessedIndex + 1,
      },
      testMode: testMode,
    });
  } catch (error) {
    console.error("Crawler error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
