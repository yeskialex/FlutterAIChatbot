/**
 * Quick test script to verify Pinecone integration
 * Uploads only 10 documents for testing
 */

require("dotenv").config();
const admin = require("firebase-admin");
const {uploadToPinecone, searchPinecone} = require("./pineconeSearch");

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccount = require("../serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "hi-project-flutter-chatbot",
  });
}

async function main() {
  try {
    console.log("🧪 Testing Pinecone integration...\n");

    // Check if API key is set
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === "your-pinecone-api-key-here") {
      console.error("❌ ERROR: PINECONE_API_KEY not set in .env file");
      process.exit(1);
    }

    // Get sample documents from Firestore (limit to 10 for testing)
    console.log("📚 Fetching 10 sample documents from Firestore...");
    const db = admin.firestore();
    const snapshot = await db.collection("document_chunks").limit(10).get();

    console.log(`✅ Found ${snapshot.size} documents\n`);

    // Transform documents
    const documents = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      documents.push({
        id: data.id || doc.id,
        content: data.content || "",
        url: data.url || "",
        title: data.title || "",
        lastUpdated: data.lastUpdated || "",
        metadata: {
          section: data.metadata?.section || "",
          type: data.contentType || data.metadata?.type || "guide",
        },
      });
    });

    // Upload to Pinecone
    console.log("📤 Uploading to Pinecone...");
    const result = await uploadToPinecone(documents);

    console.log(`✅ Upload complete! Uploaded ${result.count} documents\n`);

    // Test search
    console.log("🔍 Testing search with query: 'authentication'\n");
    const searchResults = await searchPinecone("authentication", 3);

    if (searchResults && searchResults.length > 0) {
      console.log(`✅ Search successful! Found ${searchResults.length} results:`);
      searchResults.forEach((result, i) => {
        console.log(`\n${i + 1}. ${result.metadata.title}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   URL: ${result.url}`);
      });
    } else {
      console.log("⚠️  No search results found");
    }

    console.log("\n✅ Test complete! Pinecone is working correctly!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
