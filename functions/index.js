/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest({cors: true}, (request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.testFirestore = onRequest({cors: true}, async (request, response) => {
  try {
    const db = admin.firestore();

    // Write operation: Create a test document
    const testDoc = {
      message: "Firebase connection test",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      testId: Math.random().toString(36).substr(2, 9)
    };

    const docRef = await db.collection('test').add(testDoc);
    logger.info(`Test document created with ID: ${docRef.id}`);

    // Read operation: Retrieve the document we just created
    const doc = await docRef.get();
    const data = doc.data();

    logger.info("Test document retrieved successfully", {structuredData: true});

    response.json({
      success: true,
      message: "Firebase Firestore connection test successful",
      documentId: docRef.id,
      data: data
    });

  } catch (error) {
    logger.error("Firebase connection test failed", error);
    response.status(500).json({
      success: false,
      message: "Firebase connection test failed",
      error: error.message
    });
  }
});

// Simple test function removed

// Export mock RAG functions for frontend testing
const { mockRAG, mockHistory } = require('./mockRAG');
exports.mockRAG = mockRAG;
exports.mockHistory = mockHistory;

// Export real RAG functions
const { generateAnswer, getHistory } = require('./generateAnswer');
exports.generateAnswer = generateAnswer;
exports.getHistory = getHistory;

// Export crawler function
const { runCrawler } = require('./runCrawler');
exports.runCrawler = runCrawler;

// Content-only crawler removed
