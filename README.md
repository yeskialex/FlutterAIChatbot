# Flutter_Chatbot

A RAG (Retrieval-Augmented Generation) based chatbot for Flutter documentation, powered by Google Vertex AI and Firebase.

## Tech Stack and Structure

### Frameworks and Services

- **Frontend Framework**: React 19.2.0
- **Backend (FaaS)**: Google Cloud Functions (Node.js 22)
- **Data Collection**: GitHub API (Octokit)
- **Data Storage & Indexing (RAG Core)**: Google Vertex AI Vector Search
- **AI / Language Model**: Google Gemini 2.5 Flash Lite
- **Embedding Model**: Google text-embedding-004 (768 dimensions)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Google & Email)
- **Hosting**: Firebase Hosting
- **Source Control & Collaboration**: GitHub
- **Data Source**: Flutter GitHub Repository (flutter/website)

### Project Structure

```
/Flutter_Chatbot/
├── .github/                  # GitHub Actions workflows
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── Auth/         # Authentication components
│   │   │   ├── Chat/         # Chat interface components
│   │   │   └── Common/       # Shared components
│   │   ├── services/         # API services
│   │   │   ├── firebase.js   # Firebase configuration
│   │   │   └── api.js        # API client
│   │   ├── i18n/             # Internationalization (en, ko)
│   │   └── App.js
│   ├── package.json
│   └── public/
│
├── functions/                # Google Cloud Functions
│   ├── index.js              # Main Cloud Functions entry point
│   ├── generateAnswer.js     # RAG answer generation (main endpoint)
│   ├── rag.js                # Vector search & retrieval logic
│   ├── githubCrawler.js      # GitHub documentation crawler
│   ├── getHistory.js         # Chat history retrieval
│   ├── syncMissingFiles.js   # GitHub sync utilities
│   ├── check-statefulwidget.js
│   ├── compare-sync.js
│   ├── package.json
│   └── ...
│
├── backend/                  # Backend configuration & documentation
│   ├── vertex-ai-config.md   # Vertex AI setup guide
│   └── ...
│
├── firebase.json             # Firebase deployment config
├── firestore.rules           # Firestore security rules
└── README.md
```

## Main Processes

### Process 1: Background Data Collection (Populating the Vector Database)

This process syncs Flutter documentation from GitHub and can be triggered manually or scheduled.

**Flow:**

1. **🔧 Manual Trigger** → Call the `runGitHubSync` Cloud Function
2. **🤖 GitHub Crawler** ([githubCrawler.js](functions/githubCrawler.js))
   - Fetches Flutter documentation from GitHub API (flutter/website repository)
   - Processes markdown files and extracts code examples
   - Splits documents into chunks (max 1200 chars with 200 char overlap)
   - Classifies content type (tutorial, api, guide, cookbook, reference)
   - Generates vector embeddings using Google text-embedding-004
3. **💾 Firebase Firestore** → Stores document chunks and metadata
4. **📚 Cloud Storage** → Stores vector embeddings in batch files
5. **🔍 Vertex AI Vector Search** → Indexes embeddings for similarity search

**Key Features:**
- GitHub API-based synchronization (no web scraping)
- Incremental updates based on commit SHA tracking
- Batch processing with progress tracking (3-730 files per batch)
- Automatic retry logic with exponential backoff
- ~730 Flutter documentation files indexed

**Sync Endpoint:**
```
https://rungithubsync-yt3kigee5a-uc.a.run.app
```

### Process 2: Real-Time Question Answering (RAG Pipeline)

This happens instantly when a user asks a question in the chat interface.

**Flow:**

1. **👨‍💻 User** → Asks a question in the React app
2. **🌐 React App** → Sends the question to the backend
3. **🔍 RAG Function** ([rag.js](functions/rag.js))
   - Converts the question into a vector embedding using text-embedding-004
   - Searches Firestore for relevant document chunks
   - Applies keyword-based boosting for better relevance
   - Returns top matching documentation sections
4. **🧠 Answer Generation** ([generateAnswer.js](functions/generateAnswer.js))
   - Receives user question + relevant context documents
   - Sends to Google Gemini 2.5 Flash Lite for answer generation
   - Uses low temperature (0.1) for factual, consistent responses
   - Formats and returns the final answer
5. **💬 Chat History** → Saves conversation to Firestore
6. **⬅️ Response** → Displayed to the user in the chat interface

**Key Features:**
- Hybrid search (vector + keyword matching)
- Context-aware answer generation with source citations
- Conversation history persistence
- Multi-language support (English, Korean)

## AI Model Configuration

### Gemini 2.5 Flash Lite (LLM)
- **Location**: us-central1
- **Max Output Tokens**: 2048
- **Temperature**: 0.1 (factual, low creativity)
- **Top-p**: 0.8
- **Top-k**: 40
- **Use Case**: Generate accurate answers from documentation context

### text-embedding-004 (Embedding Model)
- **Dimensions**: 768
- **Use Case**: Convert documents and queries into vector representations
- **API**: Vertex AI Prediction API

### Vector Search Configuration
- **Index ID**: 2259692108149424128
- **Distance Metric**: DOT_PRODUCT_DISTANCE
- **Algorithm**: Tree-AH
- **Storage**: gs://hi-project-flutter-chatbot-vectors

## Firebase & GCP Configuration

### Project Information
- **Project ID**: hi-project-flutter-chatbot
- **Region**: us-central1
- **Hosting URL**: https://hi-project-flutter-chatbot.web.app
- **Auth Domain**: hi-project-flutter-chatbot.firebaseapp.com

### Cloud Functions (8 deployed)
1. `generateAnswer` - Main RAG answer generation endpoint
2. `mockRAG` - Testing endpoint with hardcoded responses
3. `getHistory` - Retrieve chat conversation history
4. `mockHistory` - Testing endpoint for chat history
5. `runGitHubSync` - Trigger GitHub documentation sync
6. `checkMissingFiles` - Compare GitHub vs Firestore files
7. `helloWorld` - Health check endpoint
8. `testFirestore` - Firestore connection test

### Firestore Collections
- `document_chunks` - Processed documentation chunks with embeddings
- `chat_history` - User conversation records
- `sync_progress` - GitHub sync status tracking

## Setup and Deployment

### Prerequisites

- Node.js 22+
- Google Cloud Platform account with billing enabled
- Firebase CLI installed (`npm install -g firebase-tools`)
- GitHub personal access token (for data collection)

### Environment Variables

Create a `.env` file in the `functions/` directory:

```env
PROJECT_ID=hi-project-flutter-chatbot
REGION=us-central1
VERTEX_AI_LOCATION=us-central1
FIREBASE_PROJECT_ID=hi-project-flutter-chatbot
GITHUB_TOKEN=your_github_personal_access_token
NODE_ENV=development
```

Create a `.env` file in the `frontend/` directory:

```env
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_API_BASE_URL=https://us-central1-your-project.cloudfunctions.net/generateAnswer
```

### Local Development

```bash
# Install frontend dependencies
cd frontend
npm install
npm start

# Install backend dependencies
cd functions
npm install

# Test functions locally
firebase emulators:start --only functions

# Deploy functions to GCP
firebase deploy --only functions

# Deploy frontend to Firebase Hosting
cd frontend
npm run build
firebase deploy --only hosting
```

### Initial Data Sync

After deploying the Cloud Functions, trigger the initial sync:

```bash
# Sync all Flutter documentation (~730 files)
curl -X POST https://rungithubsync-yt3kigee5a-uc.a.run.app

# Or use the sync script
cd functions
./sync-all.sh
```

## Current Implementation Status

### Completed Features ✅
- React-based chat interface with real-time messaging
- Firebase authentication (Google & Email login)
- Conversation history management
- GitHub API-based documentation synchronization
- Document chunking and embedding generation
- Gemini LLM integration for answer generation
- Firestore data persistence
- Batch processing with progress tracking
- Multi-language UI support

### In Progress / Planned ⚠️
- Full Vertex AI Vector Search deployment (code ready, needs Index Endpoint setup)
- Link attachment content extraction
- File upload processing and integration into RAG context
- Enhanced security rules for production

## Vector Search Setup (Optional)

The project includes full Vertex AI Vector Search integration code. To enable it:

### Prerequisites
1. Vector Search Index is already created: `2259692108149424128`
2. Embeddings are stored in Cloud Storage: `gs://hi-project-flutter-chatbot-vectors`

### Deployment Steps

1. **Create an Index Endpoint** (one-time setup):
```bash
gcloud ai index-endpoints create \
  --display-name="flutter-docs-endpoint" \
  --description="Endpoint for Flutter documentation search" \
  --region=us-central1 \
  --project=hi-project-flutter-chatbot
```

2. **Deploy the Index to the Endpoint**:
```bash
# Get the endpoint ID from step 1
export ENDPOINT_ID="<your-endpoint-id>"

gcloud ai index-endpoints deploy-index $ENDPOINT_ID \
  --deployed-index-id="flutter_docs_deployed" \
  --display-name="Flutter Docs Index" \
  --index="2259692108149424128" \
  --region=us-central1 \
  --project=hi-project-flutter-chatbot
```

3. **Update the Code**:
Edit `functions/rag.js` and set the `INDEX_ENDPOINT_ID`:
```javascript
const INDEX_ENDPOINT_ID = "<your-endpoint-id>"; // Replace with actual endpoint ID
```

4. **Redeploy Cloud Functions**:
```bash
firebase deploy --only functions:generateAnswer
```

### Current Behavior
- **Without Index Endpoint**: Uses intelligent keyword-based search with synonym expansion
- **With Index Endpoint**: Uses true semantic vector search for better accuracy

Both approaches work well, but Vector Search provides superior semantic understanding.

## API Endpoints

### Main Endpoint
```
POST https://us-central1-hi-project-flutter-chatbot.cloudfunctions.net/generateAnswer
Body: {
  "userId": "user123",
  "conversationId": "conv456",
  "query": "What is Flutter?",
  "links": [],
  "files": []
}
```

### Sync Endpoint
```
POST https://rungithubsync-yt3kigee5a-uc.a.run.app
Body: {
  "batchSize": 50  // Optional, default: 10
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

---
