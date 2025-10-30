import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
// Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyCqb0IN-ryzpA0sn7YH5AOgipf2uWe9ydQ",
  authDomain: "hi-project-flutter-chatbot.firebaseapp.com",
  projectId: "hi-project-flutter-chatbot",
  storageBucket: "hi-project-flutter-chatbot.firebasestorage.app",
  messagingSenderId: "433865201521",
  appId: "1:433865201521:web:7bf5b39dc47546f75508d0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;