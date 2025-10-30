import React, { useState } from 'react';
import './App.css';
import HomePage from './components/HomePage';
import ChatInterface from './components/ChatInterface';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [conversation, setConversation] = useState(null);

  const startConversation = (weekData) => {
    setConversation({
      id: Date.now().toString(),
      week: weekData.week,
      title: weekData.title,
      initialPrompt: weekData.prompt,
      messages: []
    });
    setCurrentView('chat');
  };

  const goHome = () => {
    setCurrentView('home');
    setConversation(null);
  };

  return (
    <div className="App">
      {currentView === 'home' ? (
        <HomePage onStartConversation={startConversation} />
      ) : (
        <ChatInterface
          conversation={conversation}
          onGoHome={goHome}
          onUpdateConversation={setConversation}
        />
      )}
    </div>
  );
}

export default App;