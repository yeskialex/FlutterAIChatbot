# Environment Variables Documentation

This document describes all required environment variables for the Flutter Chatbot project.

## Functions (.env)
Location: `functions/.env`

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `PROJECT_ID` | Google Cloud Project ID | `hi-project-flutter-chatbot` | ✅ |
| `REGION` | Google Cloud region for functions | `us-central1` | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key | `/path/to/firebase-admin-key.json` | ✅ |
| `VERTEX_AI_LOCATION` | Vertex AI service region | `us-central1` | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `hi-project-flutter-chatbot` | ✅ |
| `NODE_ENV` | Environment mode | `development` or `production` | ✅ |

## Frontend (.env)
Location: `frontend/.env`

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key for web | `AIzaSyCqb0IN-ryzpA0sn7YH5AOgipf2uWe9ydQ` | ✅ |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `hi-project-flutter-chatbot.firebaseapp.com` | ✅ |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID | `hi-project-flutter-chatbot` | ✅ |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `hi-project-flutter-chatbot.firebasestorage.app` | ✅ |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `433865201521` | ✅ |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID | `1:433865201521:web:7bf5b39dc47546f75508d0` | ✅ |
| `REACT_APP_API_BASE_URL` | Cloud Functions base URL | `https://us-central1-hi-project-flutter-chatbot.cloudfunctions.net` | ✅ |
| `NODE_ENV` | Environment mode | `development` or `production` | ✅ |

## Backend (.env)
Location: `backend/.env`

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `PROJECT_ID` | Google Cloud Project ID | `hi-project-flutter-chatbot` | ✅ |
| `REGION` | Google Cloud region | `us-central1` | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | Relative path to service account key | `./firebase-admin-key.json` | ✅ |
| `VERTEX_AI_LOCATION` | Vertex AI service region | `us-central1` | ✅ |
| `VERTEX_AI_PROJECT_ID` | Vertex AI project ID | `hi-project-flutter-chatbot` | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `hi-project-flutter-chatbot` | ✅ |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `hi-project-flutter-chatbot.firebasestorage.app` | ✅ |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000,https://hi-project-flutter-chatbot.web.app` | ✅ |
| `NODE_ENV` | Environment mode | `development` or `production` | ✅ |

## System Environment Variables

| Variable | Description | Example Value | Required |
|----------|-------------|---------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Global path to service account key | `/Users/yeski/Documents/HI_Project/backend/firebase-admin-key.json` | ✅ |

## Important Notes

### Security
- **Never commit .env files to Git** - they are in .gitignore
- **Never hardcode credentials** in source code
- **Use different values** for development and production

### Setup Instructions
1. Copy example values from this documentation
2. Replace with your actual project values
3. Ensure all .env files are in .gitignore
4. Set system GOOGLE_APPLICATION_CREDENTIALS for local development

### Current Project Values
- Project ID: `hi-project-flutter-chatbot`
- Region: `us-central1`
- Storage Bucket: `hi-project-flutter-chatbot.firebasestorage.app`

### Getting Values
- **Firebase config**: Firebase Console → Project Settings → General → Your apps
- **Project ID**: Google Cloud Console → Project Info
- **Service Account**: Google Cloud Console → IAM & Admin → Service Accounts