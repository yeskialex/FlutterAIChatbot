# 🚀 Flutter AI Chatbot Frontend

## Quick Start

```bash
cd frontend
npm start
```

Opens the app at http://localhost:3000

## Features Built

✅ **Weekly Learning Flow Landing Page**
- Week 1: Choosing a Template & Basic Chat
- Week 2: Connecting RAG & Live Data
- Week 3: Freshness Filter & Deploy/Test
- Quick start prompts for common Flutter questions

✅ **Complete Chat Interface**
- Real-time messaging with mockRAG backend
- Message bubbles with formatting support
- Confidence indicators for AI responses
- Source citations with expandable details
- Language toggle (EN/KO)
- Responsive design

✅ **Connected to Working Backend**
- Uses mockRAG API: `https://us-central1-hi-project-flutter-chatbot.cloudfunctions.net/mockRAG`
- Returns realistic Flutter documentation answers
- Includes source links and confidence scores

## Usage

1. **Home Page**: Choose a weekly learning flow or quick prompt
2. **Chat**: Ask questions about Flutter development
3. **Sources**: Click "Sources" to see documentation references
4. **Language**: Toggle between English and Korean responses

## Technical Details

- **Framework**: React 18
- **Styling**: CSS Modules with modern design
- **API**: Google Cloud Functions (mockRAG)
- **Responsive**: Mobile-first design
- **Features**: Real-time chat, source citations, confidence scoring

## Next Steps

- Replace mockRAG with real RAG when backend is ready
- Add file upload functionality
- Add link attachment feature
- Implement chat history persistence