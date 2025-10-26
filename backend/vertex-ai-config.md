# Vertex AI Configuration

## Vector Search Index
- **Index ID**: `2259692108149424128`
- **Display Name**: `flutter-docs-index`
- **Region**: `us-central1`
- **Project**: `hi-project-flutter-chatbot`

## Storage Bucket
- **Bucket**: `gs://hi-project-flutter-chatbot-vectors`
- **Initial Data Path**: `gs://hi-project-flutter-chatbot-vectors/initial/`

## Index Configuration
- **Dimensions**: 768 (compatible with text-embedding-004)
- **Distance Measure**: DOT_PRODUCT_DISTANCE
- **Algorithm**: Tree-AH with 500 leaf node embeddings

## Usage in Code
```javascript
const indexName = 'projects/hi-project-flutter-chatbot/locations/us-central1/indexes/2259692108149424128';
const endpoint = 'https://us-central1-aiplatform.googleapis.com';
```

## Status Check Command
```bash
gcloud ai operations describe 577273514734649344 --index=2259692108149424128 --region=us-central1
```

## Next Steps
1. Wait for index creation to complete (~20-30 minutes)
2. Create helper modules (rag.js, llm.js)
3. Test vector search functionality