const {Pinecone} = require("@pinecone-database/pinecone");
const {generateLocalEmbedding} = require("./localEmbeddings");

// Initialize Pinecone client
let pinecone = null;
let index = null;

const INDEX_NAME = "flutter-docs";
const DIMENSION = 768; // EmbeddingGemma output dimension

/**
 * Initialize Pinecone connection
 * @return {Promise<void>}
 */
async function initPinecone() {
  if (pinecone && index) {
    return index;
  }

  try {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY not found in environment variables");
    }

    console.log("🔌 Initializing Pinecone connection...");

    pinecone = new Pinecone({
      apiKey: apiKey,
    });

    // Check if index exists, create if not
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some((idx) => idx.name === INDEX_NAME);

    if (!indexExists) {
      console.log(`📦 Creating Pinecone index: ${INDEX_NAME}...`);
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSION,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`✅ Index ${INDEX_NAME} created successfully`);

      // Wait for index to be ready
      console.log("⏳ Waiting for index to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Get index
    index = pinecone.index(INDEX_NAME);

    console.log("✅ Pinecone connected successfully");

    return index;
  } catch (error) {
    console.error("❌ Failed to initialize Pinecone:", error);
    throw error;
  }
}

/**
 * Search for similar documents using Pinecone vector search
 * @param {string} query - Search query text
 * @param {number} topK - Number of results to return (default: 5)
 * @return {Promise<Array>} - Array of similar documents with scores
 */
async function searchPinecone(query, topK = 5) {
  try {
    console.log(`🔍 Searching Pinecone for: "${query}"`);

    // Generate embedding for the query using FREE local EmbeddingGemma
    console.log("💰 Using FREE local EmbeddingGemma for query embedding");
    const queryEmbedding = await generateLocalEmbedding(query);
    console.log(`✅ Generated query embedding (${queryEmbedding.length} dimensions)`);

    // Initialize Pinecone
    const idx = await initPinecone();

    // Search in Pinecone (NO MEMORY OVERHEAD - runs on Pinecone servers)
    console.log("🚀 Querying Pinecone vector database...");
    const results = await idx.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });

    console.log(`✅ Pinecone returned ${results.matches.length} results`);

    // Transform Pinecone results to our format
    const documents = results.matches.map((match, i) => {
      console.log(`  ${i + 1}. [${(match.score * 100).toFixed(1)}%] ${match.metadata?.title || match.id}`);

      return {
        id: match.id,
        content: match.metadata?.content || "",
        url: match.metadata?.url || "",
        lastUpdated: match.metadata?.lastUpdated || "",
        similarity: match.score,
        metadata: {
          title: match.metadata?.title || "Flutter Documentation",
          section: match.metadata?.section || "General",
          type: match.metadata?.type || "guide",
        },
      };
    });

    console.log(`🎯 Returning ${documents.length} documents from Pinecone`);

    return documents;
  } catch (error) {
    console.error("❌ Pinecone search error:", error);
    // Return null to trigger fallback to keyword search
    return null;
  }
}

/**
 * Upload documents to Pinecone (batch operation)
 * @param {Array} documents - Array of {id, content, metadata} objects
 * @return {Promise<Object>} - Upload result
 */
async function uploadToPinecone(documents) {
  try {
    console.log(`📤 Uploading ${documents.length} documents to Pinecone...`);

    // Initialize Pinecone
    const idx = await initPinecone();

    // Generate embeddings for all documents using FREE local model
    const vectors = [];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      console.log(`Generating embedding ${i + 1}/${documents.length}: ${doc.id}`);

      const embedding = await generateLocalEmbedding(doc.content);

      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          content: doc.content.substring(0, 10000), // Pinecone metadata limit
          url: doc.url || "",
          title: doc.title || "",
          lastUpdated: doc.lastUpdated || "",
          section: doc.metadata?.section || "",
          type: doc.metadata?.type || "guide",
        },
      });

      // Upload in batches of 100 to avoid timeouts
      if (vectors.length >= 100 || i === documents.length - 1) {
        console.log(`📦 Uploading batch of ${vectors.length} vectors...`);
        await idx.upsert(vectors);
        console.log(`✅ Batch uploaded successfully`);
        vectors.length = 0; // Clear the batch
      }
    }

    console.log(`✅ Successfully uploaded ${documents.length} documents to Pinecone`);

    return {
      success: true,
      count: documents.length,
    };
  } catch (error) {
    console.error("❌ Error uploading to Pinecone:", error);
    throw error;
  }
}

/**
 * Check if Pinecone is configured and available
 * @return {boolean} - Whether Pinecone is ready to use
 */
function isPineconeConfigured() {
  return !!process.env.PINECONE_API_KEY;
}

module.exports = {
  searchPinecone,
  uploadToPinecone,
  isPineconeConfigured,
  initPinecone,
};
