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

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/textembedding-gecko@003:predict`;

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

    // TODO: Implement actual vector search when index is ready
    // For now, return mock data for testing

    console.log(`Searching for: "${query}" (returning mock data)`);

    // Mock similar documents - replace with real search later
    const mockResults = [
      {
        id: 'flutter_widgets_button',
        content: 'ElevatedButton is a Material Design button that displays with elevation. Use ElevatedButton for primary actions.',
        url: 'https://docs.flutter.dev/cookbook/forms/retrieve-input',
        lastUpdated: '2024-01-15',
        similarity: 0.85,
        metadata: {
          title: 'Flutter Buttons Guide',
          section: 'Widgets',
          type: 'tutorial'
        }
      },
      {
        id: 'flutter_styling_themes',
        content: 'ThemeData allows you to customize the overall visual theme of your Flutter app, including button styles.',
        url: 'https://docs.flutter.dev/cookbook/design/themes',
        lastUpdated: '2024-01-10',
        similarity: 0.78,
        metadata: {
          title: 'App Themes',
          section: 'Design',
          type: 'guide'
        }
      }
    ];

    return mockResults.slice(0, topK);

  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
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