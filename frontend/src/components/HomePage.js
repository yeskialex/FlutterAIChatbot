import React from 'react';
import './HomePage.css';

const HomePage = ({ onStartConversation, user, onSignOut, onTestConversations, onTestRetrieval }) => {
  const weeklyFlows = [
    {
      week: 1,
      title: "Choosing a Template & Basic Chat",
      description: "Learn to set up your first Flutter project and create a basic chat interface",
      prompt: "I want to learn about choosing a Flutter template and building a basic chat interface. Can you guide me through setting up my first Flutter project?",
      color: "#4CAF50"
    },
    {
      week: 2,
      title: "Connecting RAG & Live Data",
      description: "Integrate real-time data sources and implement RAG for intelligent responses",
      prompt: "How do I connect my Flutter app to external data sources and implement RAG (Retrieval-Augmented Generation) for smarter responses?",
      color: "#2196F3"
    },
    {
      week: 3,
      title: "Freshness Filter & Deploy/Test",
      description: "Implement data freshness filtering and deploy your app for testing",
      prompt: "I need help implementing data freshness filters and deploying my Flutter app. What are the best practices for testing and deployment?",
      color: "#FF9800"
    }
  ];

  const quickPrompts = [
    "How do I add payment functionality to Flutter?",
    "What are the best Flutter widgets for UI design?",
    "How to implement authentication in Flutter?"
  ];

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="user-bar">
          <div className="user-info">
            <span className="user-greeting">Welcome back, {user?.name || 'User'}!</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="sign-out-btn" onClick={onSignOut}>
            Sign Out
          </button>
        </div>

        <h1>🚀 Flutter AI Chatbot</h1>
        <p>Your intelligent companion for Flutter development</p>

        <button
          className="new-chat-btn"
          onClick={() => onStartConversation({
            week: 'new',
            title: 'New Chat',
            initialPrompt: null // No premade prompt - blank chat
          })}
        >
          💬 Start New Chat
        </button>
      </header>

      <div className="weekly-flows">
        <h2>📚 Weekly Learning Flow</h2>
        <div className="flow-cards">
          {weeklyFlows.map((flow) => (
            <div
              key={flow.week}
              className="flow-card"
              style={{ borderLeftColor: flow.color }}
              onClick={() => onStartConversation(flow)}
            >
              <div className="flow-week">Week {flow.week}</div>
              <h3>{flow.title}</h3>
              <p>{flow.description}</p>
              <button className="start-btn" style={{ backgroundColor: flow.color }}>
                Start Learning →
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="quick-prompts">
        <h2>⚡ Quick Start Prompts</h2>
        <div className="prompt-buttons">
          {quickPrompts.map((prompt, index) => (
            <button
              key={index}
              className="prompt-btn"
              onClick={() => onStartConversation({
                week: 'quick',
                title: 'Quick Question',
                prompt: prompt
              })}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Debug tools - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ padding: '20px', borderTop: '1px solid #333', marginTop: '20px' }}>
          <h3 style={{ color: 'white', marginBottom: '10px' }}>Debug Tools:</h3>
          <button
            onClick={onTestConversations}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Create Test Conversations
          </button>
          <button
            onClick={onTestRetrieval}
            style={{
              padding: '10px 20px',
              backgroundColor: '#764ba2',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Test Conversation Retrieval
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;