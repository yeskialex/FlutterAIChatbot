import React, { useState, useEffect } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import ChatInterface from './components/ChatInterface';
import AuthPage from './components/AuthPage';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { signOutUser } from './firebase/authService';

function App() {
  const [currentView, setCurrentView] = useState('auth');
  const [conversation, setConversation] = useState(null);
  const [user, setUser] = useState(null);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0]
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setCurrentView('home');
      } else {
        // User is signed out
        setUser(null);
        localStorage.removeItem('user');
        setCurrentView('auth');
        setConversation(null);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setCurrentView('home');
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      // onAuthStateChanged will handle the state updates
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const startConversation = (weekData) => {
    setConversation({
      id: Date.now().toString(),
      week: weekData.week,
      title: weekData.title,
      initialPrompt: weekData.prompt,
      messages: [],
      userId: user.id
    });
    setCurrentView('chat');
  };

  const goHome = () => {
    setCurrentView('home');
    setConversation(null);
  };

  return (
    <div className="App">
      {currentView === 'auth' ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      ) : currentView === 'home' ? (
        <HomePage
          onStartConversation={startConversation}
          user={user}
          onSignOut={handleSignOut}
        />
      ) : (
        <ChatInterface
          conversation={conversation}
          onGoHome={goHome}
          onUpdateConversation={setConversation}
          user={user}
        />
      )}
    </div>
  );
}

export default App;