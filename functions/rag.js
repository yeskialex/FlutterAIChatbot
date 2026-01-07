const {VertexAI} = require("@google-cloud/vertexai");
const {Storage} = require("@google-cloud/storage");

// Initialize Vertex AI and Storage
// Note: vertexAi is reserved for future direct usage
// eslint-disable-next-line no-unused-vars
const vertexAi = new VertexAI({
  project: "hi-project-flutter-chatbot",
  location: "us-central1",
});

const storage = new Storage();
const bucket = storage.bucket("hi-project-flutter-chatbot-vectors");

// Vector Search Index configuration
const INDEX_ID = "2259692108149424128";
const PROJECT_ID = "hi-project-flutter-chatbot";
const LOCATION = "us-central1";
const INDEX_ENDPOINT = `projects/${PROJECT_ID}/locations/${LOCATION}/indexes/${INDEX_ID}`;

// Index Endpoint ID (needed for deployed indexes)
// This needs to be created and the index deployed to it
// For now, we'll use null and fallback to keyword search
const INDEX_ENDPOINT_ID = null; // Set this when index is deployed to an endpoint

/**
 * Generate embeddings for text using Vertex AI
 * @param {string} text - Text to embed
 * @return {Promise<number[]>} - 768-dimensional embedding vector
 */
async function generateEmbedding(text) {
  try {
    // Use Google Auth to call Vertex AI REST API directly
    const {GoogleAuth} = require("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const authClient = await auth.getClient();
    const projectId = "hi-project-flutter-chatbot";
    const location = "us-central1";

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

    const requestBody = {
      instances: [{
        content: text,
      }],
    };

    const response = await authClient.request({
      url: url,
      method: "POST",
      data: requestBody,
    });

    if (response.data.predictions && response.data.predictions[0]) {
      return response.data.predictions[0].embeddings.values;
    } else {
      console.log("Full API response:", JSON.stringify(response.data, null, 2));
      throw new Error("Unexpected API response structure");
    }
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Search Vector Index using Vertex AI Matching Engine
 * @param {number[]} queryEmbedding - Query embedding vector
 * @param {number} topK - Number of results to return
 * @return {Promise<Array>} - Array of matching documents
 */
async function searchVectorIndex(queryEmbedding, topK = 5) {
  try {
    // Check if index endpoint is configured
    if (!INDEX_ENDPOINT_ID) {
      console.log("Vector Search Index Endpoint not configured, using fallback");
      return null;
    }

    const {GoogleAuth} = require("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const authClient = await auth.getClient();
    const projectId = PROJECT_ID;
    const location = LOCATION;

    // Vertex AI Matching Engine endpoint - requires deployed index
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexEndpoints/${INDEX_ENDPOINT_ID}:findNeighbors`;

    const requestBody = {
      deployedIndexId: INDEX_ID,
      queries: [{
        datapoint: {
          datapointId: "query",
          featureVector: queryEmbedding,
        },
        neighborCount: topK,
      }],
      returnFullDatapoint: false,
    };

    console.log(`Calling Vector Search API at: ${endpoint}`);

    const response = await authClient.request({
      url: endpoint,
      method: "POST",
      data: requestBody,
    });

    if (!response.data || !response.data.nearestNeighbors || !response.data.nearestNeighbors[0]) {
      console.log("No results from Vector Search");
      return [];
    }

    const neighbors = response.data.nearestNeighbors[0].neighbors || [];
    console.log(`Vector Search found ${neighbors.length} neighbors`);

    // Fetch document metadata from Firestore using the IDs
    const admin = require("firebase-admin");
    const db = admin.firestore();

    const documents = [];
    for (const neighbor of neighbors) {
      const docId = neighbor.datapoint.datapointId;
      const distance = neighbor.distance || 0;
      const similarity = 1 - distance; // Convert distance to similarity

      try {
        const docRef = await db.collection("document_chunks").doc(docId).get();
        if (docRef.exists) {
          const data = docRef.data();
          documents.push({
            id: docId,
            content: data.content,
            url: data.url,
            lastUpdated: data.lastUpdated,
            similarity: similarity,
            metadata: {
              title: data.title || data.metadata?.title || "Flutter Documentation",
              section: data.metadata?.section || "General",
              type: data.contentType || data.metadata?.type || "guide",
            },
          });
        }
      } catch (error) {
        console.error(`Error fetching document ${docId}:`, error);
      }
    }

    return documents;
  } catch (error) {
    console.error("Vector Search API error:", error.message);
    // Return null to trigger fallback
    return null;
  }
}

/**
 * Add documents to vector index
 * @param {Array} documents - Array of {id, text, metadata} objects
 * @return {Promise<void>}
 */
async function addDocumentsToIndex(documents) {
  try {
    const embeddings = [];

    // Generate embeddings for all documents
    for (const doc of documents) {
      const embedding = await generateEmbedding(doc.text);
      embeddings.push({
        id: doc.id,
        embedding: embedding,
        restricts: [],
        allows: [],
        metadata: doc.metadata || {},
      });
    }

    // Create JSONL file for batch upload
    const jsonlContent = embeddings.map((item) => JSON.stringify(item)).join("\n");
    const timestamp = Date.now();
    const fileName = `batch_${timestamp}.jsonl`;

    // Upload to Cloud Storage
    const file = bucket.file(`updates/${fileName}`);
    await file.save(jsonlContent, {
      metadata: {
        contentType: "application/json",
      },
    });

    console.log(`Uploaded ${embeddings.length} embeddings to ${fileName}`);

    // Note: In production, you'd trigger index update here
    // For now, we'll handle updates manually

    return {
      success: true,
      fileName: fileName,
      count: embeddings.length,
    };
  } catch (error) {
    console.error("Error adding documents to index:", error);
    throw error;
  }
}

/**
 * Search for similar documents in vector index
 * @param {string} query - Search query text
 * @param {number} topK - Number of results to return (default: 5)
 * @return {Promise<Array>} - Array of similar documents with scores
 */
async function findSimilarDocuments(query, topK = 5) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    console.log(`Searching for: "${query}" using vector similarity`);

    // Try to use vector search first, fallback to Firestore if needed
    try {
      // Try actual Vector Search API first
      const vectorResults = await searchVectorIndex(queryEmbedding, topK);

      if (vectorResults && vectorResults.length > 0) {
        console.log(`Vector Search returned ${vectorResults.length} results`);
        return vectorResults;
      }

      // Fallback to Firestore-based search if Vector Search fails or returns no results
      console.log("Falling back to Firestore-based keyword search");
      const admin = require("firebase-admin");
      const db = admin.firestore();

      // Get all document chunks from Firestore
      // NOTE: This is inefficient and should be replaced with Vertex AI Vector Search
      // We need to get ALL documents since we can't predict which ones are relevant
      const snapshot = await db.collection("document_chunks")
          .get();

      console.log(`Total documents in Firestore: ${snapshot.size}`);

      if (snapshot.empty) {
        console.log("No crawled documents found, returning empty results");
        return [];
      }

      const documents = [];

      // Use simple text-based similarity (faster, no embedding generation needed)
      const queryLower = query.toLowerCase();
      // Split by whitespace and remove punctuation
      const queryTerms = queryLower
          .replace(/[^a-z0-9\s]/g, " ") // Replace punctuation with space
          .split(/\s+/)
          .filter((t) => t.length > 2);

      console.log(`Query: "${query}", Terms: [${queryTerms.join(", ")}]`);

      // Extract key terms (remove common words and generic verbs)
      const commonWords = new Set([
        "what", "is", "the", "a", "an", "how", "to", "in", "on", "at", "for", "with", "about",
        "do", "i", "my", "are", "of", "from", "by", "as", "be", "can", "this", "that",
        // Generic action verbs that don't help with search
        "add", "use", "make", "get", "set", "implement", "create", "build", "using",
        "functionality", "feature", "features", "best", "good",
      ]);
      const keyTerms = queryTerms.filter((term) => !commonWords.has(term));

      // Add synonyms for common technical terms to improve matching
      const synonymMap = {
        "authentication": ["auth", "login", "signin", "signup", "user", "account", "firebase", "google", "oauth"],
        "payment": ["billing", "purchase", "monetization", "subscription", "checkout", "stripe", "iap"],
        "ui": ["interface", "design", "layout", "screen", "view", "theme", "styling"],
        "widgets": ["widget", "component", "ui", "element", "scaffold", "container"],
        "login": ["auth", "authentication", "signin", "firebase", "user"],
        "firebase": ["auth", "authentication", "firestore", "database", "backend"],
      };

      // Expand query with synonyms
      const expandedTerms = [...keyTerms];
      for (const term of keyTerms) {
        if (synonymMap[term]) {
          expandedTerms.push(...synonymMap[term]);
        }
      }

      console.log(`Key terms after filtering: [${keyTerms.join(", ")}]`);

      // Check if query is very general (like "What is Flutter?")
      const isGeneralQuery = keyTerms.length === 1 && ["flutter", "dart", "widget"].includes(keyTerms[0]);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const contentLower = (data.content || "").toLowerCase();
        const titleLower = (data.title || "").toLowerCase();
        const urlLower = (data.url || "").toLowerCase();
        const githubPath = (data.githubPath || "").toLowerCase();

        let similarity = 0;
        const matches = [];

        // For general queries, prioritize intro content FIRST before other scoring
        if (isGeneralQuery) {
          // Very strong boost for get-started pages
          if (githubPath.includes("get-started/fundamentals") || githubPath.includes("get-started/index")) {
            similarity += 10.0;
            matches.push("get_started_page");
          } else if (githubPath.includes("get-started/")) {
            similarity += 5.0;
            matches.push("get_started_section");
          }

          // Penalize _includes and add-to-app heavily for general queries
          if (githubPath.includes("_includes/") || githubPath.includes("add-to-app/")) {
            similarity -= 5.0;
            matches.push("penalized_includes");
          }
        }

        // Exact phrase match in title gets very high score
        if (titleLower.includes(queryLower)) {
          similarity += 2.0;
          matches.push("exact_title");
        }

        // Exact phrase match in content
        if (contentLower.includes(queryLower)) {
          similarity += 0.5;
          matches.push("exact_content");
        }

        // Key term matches (weighted more heavily)
        // Use expandedTerms (includes synonyms) for better matching
        for (const term of expandedTerms) {
          // Original key terms get higher weight than synonyms
          let termWeight = keyTerms.includes(term) ? 1.0 : 0.7;

          // Title matches are most important
          if (titleLower.includes(term)) {
            similarity += 1.0 * termWeight;
            matches.push(`title:${term}`);
          }
          // URL matches
          if (urlLower.includes(term) || githubPath.includes(term)) {
            similarity += 0.5 * termWeight;
            matches.push(`path:${term}`);
          }
          // Content matches
          const termCount = (contentLower.match(new RegExp(term, "g")) || []).length;
          if (termCount > 0) {
            // More occurrences = higher score, but with diminishing returns
            const contentScore = Math.min(0.3 * Math.log(termCount + 1), 0.8);
            similarity += contentScore * termWeight;
            matches.push(`content:${term}(${termCount})`);
          }
        }

        // Boost for Flutter-specific content types
        if (data.contentType === "api" && keyTerms.some((t) => titleLower.includes(t))) {
          similarity += 0.5;
          matches.push("api_doc");
        }

        // Always add documents (even with negative similarity) so we can sort and filter properly
        documents.push({
          id: data.id,
          content: data.content,
          url: data.url,
          lastUpdated: data.lastUpdated,
          similarity: similarity,
          matches: matches,
          metadata: {
            title: data.title || data.metadata?.title || "Flutter Documentation",
            section: data.metadata?.section || "General",
            type: data.contentType || data.metadata?.type || "guide",
          },
        });
      }

      // Sort by similarity score (highest first) and return top K
      const sortedDocs = documents
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK);

      console.log(`Found ${sortedDocs.length} documents with vector similarity`);
      console.log("Top results:");
      sortedDocs.forEach((doc, i) => {
        console.log(`  ${i + 1}. [${doc.similarity.toFixed(2)}] ${doc.metadata.title}`);
        console.log(`     Matches: ${doc.matches.join(", ")}`);
        console.log(`     URL: ${doc.url}`);
      });

      return sortedDocs;
    } catch (vectorError) {
      console.error("Vector search error, using basic search:", vectorError);
      // Fallback to basic Firestore search
      return await basicFirestoreSearch(query, topK);
    }
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @return {number} Similarity score between 0 and 1
 */
function calculateCosineSimilarity(vectorA, vectorB) {
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Basic Firestore search fallback
 * @param {string} query
 * @param {number} topK
 * @return {Promise<Array>}
 */
async function basicFirestoreSearch(query, topK) {
  const admin = require("firebase-admin");
  const db = admin.firestore();

  const snapshot = await db.collection("document_chunks")
      .orderBy("createdAt", "desc")
      .limit(topK)
      .get();

  const documents = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    documents.push({
      id: data.id,
      content: data.content,
      url: data.url,
      lastUpdated: data.lastUpdated,
      similarity: 0.7, // Default similarity for basic search
      metadata: {
        title: data.title || data.metadata?.title || "Flutter Documentation",
        section: data.metadata?.section || "General",
        type: data.contentType || data.metadata?.type || "guide",
      },
    });
  });

  return documents;
}

/**
 * Check if vector index is ready
 * @return {Promise<boolean>} - Whether index is ready for use
 */
async function isIndexReady() {
  // TODO: Implement actual index status check
  // For now, return false since index is still building
  return false;
}

module.exports = {
  generateEmbedding,
  addDocumentsToIndex,
  findSimilarDocuments,
  searchVectorIndex,
  isIndexReady,
  INDEX_ID,
  INDEX_ENDPOINT,
};
