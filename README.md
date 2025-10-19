# Flutter_Chatbot
## Tech Stack and Structure

### Frameworks and Services
Frontend framework: React 

Backend (FaaS): Google Cloud Function
Data Collection: Google Cloud Scheduler
Data Storage & Indexing (The RAG Core): Google Vector Search 
AI / Language Model: Gemini
Source Control & Collaboration: GitHub

Data source: Flutter Docs (https://docs.flutter.dev/) 


### Structure
/flutter-chatbot-project/
├── .github/              # For GitHub Actions (scheduler)
├── /frontend/            #React App
│   ├── /src/
│   ├── package.json
│   └── ... (all your React files)
│
├── /backend/             #Google Cloud Functions
│   ├── /functions/       # A folder for individual functions
│   │   ├── generateAnswer.js
│   │   └── getDocuments.js
│   ├── package.json      # Dependencies for backend code
│   └── ...
│
└── README.md


## Main Processes

### Process 1: The Background Process (Populating the Library)
This runs on a schedule (e.g., weekly) and doesn't involve the user at all.
Flow:
⏰ Google Cloud Scheduler: The process starts.
➡️ Triggers...
🤖 Crawler Cloud Function (runCrawler.js): This function wakes up.
It reads websites like the Flutter docs.
It sends the text to the Gemini API to be converted into numerical vector embeddings.
➡️ Stores Embeddings in...
📚 Vertex AI Vector Search: The specialized database that holds all the knowledge.

### Process 2: The Real-Time Process (Answering a Question)
This happens instantly when a user interacts with the chat app.
Flow:
👨‍💻 User: Asks a question in the app
🌐 React App: Which sends the question to the RAG Cloud Function
🧠 RAG Cloud Function (generateAnswer.js): This function is the orchestrator.
Step A: It first asks 📚 Vertex AI Vector Search, "What are the most relevant documents for this question?"
Step B: Vertex AI sends the relevant documents back.
Step C: The function then sends the user's question plus the relevant documents to the Gemini API to generate a final answer.
⬅️ Sends Answer Back: The generated answer is returned to the React App for the user to see.

