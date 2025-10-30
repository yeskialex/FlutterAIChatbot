const { VertexAI } = require('@google-cloud/vertexai');
const { Storage } = require('@google-cloud/storage');

// Initialize Vertex AI and Storage
const vertex_ai = new VertexAI({
  project: 'hi-project-flutter-chatbot',
  location: 'us-central1'
});

const storage = new Storage();
const bucket = storage.bucket('hi-project-flutter-chatbot-vectors');

// Vector Search Index configuration
const INDEX_ID = '2259692108149424128';
const PROJECT_ID = 'hi-project-flutter-chatbot';
const LOCATION = 'us-central1';
const INDEX_ENDPOINT = `projects/${PROJECT_ID}/locations/${LOCATION}/indexes/${INDEX_ID}`;

/**
 * Generate embeddings for text using Vertex AI
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 768-dimensional embedding vector
 */
async function generateEmbedding(text) {
  try {
    // Use Google Auth to call Vertex AI REST API directly
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const authClient = await auth.getClient();
    const projectId = 'hi-project-flutter-chatbot';
    const location = 'us-central1';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

    const requestBody = {
      instances: [{
        content: text
      }]
    };

    const response = await authClient.request({
      url: url,
      method: 'POST',
      data: requestBody
    });

    if (response.data.predictions && response.data.predictions[0]) {
      return response.data.predictions[0].embeddings.values;
    } else {
      console.log('Full API response:', JSON.stringify(response.data, null, 2));
      throw new Error('Unexpected API response structure');
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Add documents to vector index
 * @param {Array} documents - Array of {id, text, metadata} objects
 * @returns {Promise<void>}
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
        metadata: doc.metadata || {}
      });
    }

    // Create JSONL file for batch upload
    const jsonlContent = embeddings.map(item => JSON.stringify(item)).join('\n');
    const timestamp = Date.now();
    const fileName = `batch_${timestamp}.jsonl`;

    // Upload to Cloud Storage
    const file = bucket.file(`updates/${fileName}`);
    await file.save(jsonlContent, {
      metadata: {
        contentType: 'application/json'
      }
    });

    console.log(`Uploaded ${embeddings.length} embeddings to ${fileName}`);

    // Note: In production, you'd trigger index update here
    // For now, we'll handle updates manually

    return {
      success: true,
      fileName: fileName,
      count: embeddings.length
    };

  } catch (error) {
    console.error('Error adding documents to index:', error);
    throw error;
  }
}

/**
 * Search for similar documents in vector index
 * @param {string} query - Search query text
 * @param {number} topK - Number of results to return (default: 5)
 * @returns {Promise<Array>} - Array of similar documents with scores
 */
async function findSimilarDocuments(query, topK = 5) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    console.log(`Searching for: "${query}" using vector similarity`);

    // Try to use vector search first, fallback to Firestore if needed
    try {
      // TODO: Implement actual Vector Search API call when index is ready
      // For now, use hybrid approach: Firestore + embedding similarity calculation

      const admin = require('firebase-admin');
      const db = admin.firestore();

      // Get all document chunks from Firestore
      const snapshot = await db.collection('document_chunks')
        .orderBy('createdAt', 'desc')
        .limit(topK * 3) // Get more docs for similarity calculation
        .get();

      if (snapshot.empty) {
        console.log('No crawled documents found, returning empty results');
        return [];
      }

      const documents = [];

      // Calculate similarity for each document
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Generate embedding for document content
        const docEmbedding = await generateEmbedding(data.content);

        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(queryEmbedding, docEmbedding);

        documents.push({
          id: data.id,
          content: data.content,
          url: data.url,
          lastUpdated: data.lastUpdated,
          similarity: similarity,
          metadata: {
            title: data.title || data.metadata?.title || 'Flutter Documentation',
            section: data.metadata?.section || 'General',
            type: data.contentType || data.metadata?.type || 'guide'
          }
        });
      }

      // Sort by similarity score (highest first) and return top K
      const sortedDocs = documents
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      console.log(`Found ${sortedDocs.length} documents with vector similarity`);
      return sortedDocs;

    } catch (vectorError) {
      console.error('Vector search error, using basic search:', vectorError);
      // Fallback to basic Firestore search
      return await basicFirestoreSearch(query, topK);
    }

  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @returns {number} Similarity score between 0 and 1
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
 * @returns {Promise<Array>}
 */
async function basicFirestoreSearch(query, topK) {
  const admin = require('firebase-admin');
  const db = admin.firestore();

  const snapshot = await db.collection('document_chunks')
    .orderBy('createdAt', 'desc')
    .limit(topK)
    .get();

  const documents = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    documents.push({
      id: data.id,
      content: data.content,
      url: data.url,
      lastUpdated: data.lastUpdated,
      similarity: 0.7, // Default similarity for basic search
      metadata: {
        title: data.title || data.metadata?.title || 'Flutter Documentation',
        section: data.metadata?.section || 'General',
        type: data.contentType || data.metadata?.type || 'guide'
      }
    });
  });

  return documents;
}

/**
 * Check if vector index is ready
 * @returns {Promise<boolean>} - Whether index is ready for use
 */
async function isIndexReady() {
  try {
    // TODO: Implement actual index status check
    // For now, return false since index is still building
    return false;
  } catch (error) {
    console.error('Error checking index status:', error);
    return false;
  }
}

module.exports = {
  generateEmbedding,
  addDocumentsToIndex,
  findSimilarDocuments,
  isIndexReady,
  INDEX_ID,
  INDEX_ENDPOINT
};