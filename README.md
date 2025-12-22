# Flutter_Chatbot

A RAG (Retrieval-Augmented Generation) based chatbot for Flutter documentation, powered by OpenAI and Google Cloud Platform.

## Tech Stack and Structure

### Frameworks and Services

- **Frontend Framework**: React
- **Backend (FaaS)**: Google Cloud Functions
- **Data Collection**: Google Cloud Scheduler
- **Data Storage & Indexing (RAG Core)**: Google Vertex AI Vector Search
- **AI / Language Model**: OpenAI (GPT-4)
- **Source Control & Collaboration**: GitHub
- **Data Source**: Flutter GitHub Repository (via GitHub API)

### Project Structure

```
/Flutter_Chatbot/
├── .github/                  # GitHub Actions workflows
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── services/         # API services
│   │   └── App.js
│   ├── package.json
│   └── public/
│
├── functions/                # Google Cloud Functions
│   ├── crawler.js            # Web crawler function
│   ├── llm.js                # LLM integration (OpenAI)
│   ├── search.js             # Vector search function
│   ├── syncMissingFiles.js   # GitHub sync utilities
│   ├── check-statefulwidget.js
│   ├── compare-sync.js
│   ├── package.json
│   └── ...
│
└── README.md
```


## Main Processes

### Process 1: Background Data Collection (Populating the Vector Database)

This process runs on a schedule (e.g., weekly) via Google Cloud Scheduler and doesn't involve user interaction.

**Flow:**

1. **⏰ Google Cloud Scheduler** → Triggers the crawler function
2. **🤖 Crawler Cloud Function** ([crawler.js](functions/crawler.js))
   - Fetches Flutter documentation from GitHub API
   - Processes markdown files and code examples
   - Generates vector embeddings using OpenAI's embedding model
3. **📚 Vertex AI Vector Search** → Stores embeddings for fast similarity search

**Key Features:**
- Automatic synchronization with Flutter repository
- Batch processing with progress tracking
- Incremental updates to avoid redundant processing

### Process 2: Real-Time Question Answering (RAG Pipeline)

This happens instantly when a user asks a question in the chat interface.

**Flow:**

1. **👨‍💻 User** → Asks a question in the React app
2. **🌐 React App** → Sends the question to the backend
3. **🔍 Search Function** ([search.js](functions/search.js))
   - Converts the question into a vector embedding
   - Queries Vertex AI Vector Search for relevant documents
   - Returns the most similar documentation chunks
4. **🧠 LLM Function** ([llm.js](functions/llm.js))
   - Receives user question + relevant context documents
   - Sends to OpenAI GPT-4 for answer generation
   - Formats and returns the final answer
5. **⬅️ Response** → Displayed to the user in the chat interface

**Key Features:**
- Semantic search for accurate document retrieval
- Context-aware answer generation
- Real-time response streaming

## Setup and Deployment

### Prerequisites

- Node.js 18+
- Google Cloud Platform account
- OpenAI API key
- GitHub personal access token (for data collection)

### Environment Variables

Create a `.env` file in the `functions/` directory:

```env
OPENAI_API_KEY=your_openai_api_key
GITHUB_TOKEN=your_github_token
GCP_PROJECT_ID=your_gcp_project_id
VECTOR_SEARCH_INDEX_ENDPOINT=your_vector_search_endpoint
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

# Deploy functions to GCP
firebase deploy --only functions
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

