/**
 * One-time script to upload all Flutter documentation to Pinecone
 * Run this script locally after setting PINECONE_API_KEY in .env
 */

require("dotenv").config();
const admin = require("firebase-admin");
const {uploadToPinecone} = require("./pineconeSearch");

// Initialize Firebase Admin
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function main() {
  try {
    console.log("🚀 Starting Pinecone upload process...\n");

    // Check if API key is set
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === "your-pinecone-api-key-here") {
      console.error("❌ ERROR: PINECONE_API_KEY not set in .env file");
      console.error("   Please get your API key from: https://app.pinecone.io/");
      process.exit(1);
    }

    // Get all documents from Firestore
    console.log("📚 Fetching documents from Firestore...");
    const db = admin.firestore();
    const snapshot = await db.collection("document_chunks").get();

    console.log(`✅ Found ${snapshot.size} documents in Firestore\n`);

    if (snapshot.empty) {
      console.log("⚠️  No documents found in Firestore");
      process.exit(0);
    }

    // Transform documents to upload format
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

    console.log(`📤 Uploading ${documents.length} documents to Pinecone...`);
    console.log("⏳ This may take a while (using FREE local EmbeddingGemma)...\n");

    const result = await uploadToPinecone(documents);

    console.log("\n✅ Upload complete!");
    console.log(`   - Documents uploaded: ${result.count}`);
    console.log(`   - Status: ${result.success ? "SUCCESS" : "FAILED"}`);

    console.log("\n💡 You can now use Pinecone vector search in your app!");
    console.log("   The search will automatically use Pinecone when available.");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Upload failed:", error);
    process.exit(1);
  }
}

main();
