import React from 'react';
import './HomePage.css';

const HomePage = ({ onStartConversation }) => {
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
        <h1>🚀 Flutter AI Chatbot</h1>
        <p>Your intelligent companion for Flutter development</p>
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
    </div>
  );
};

export default HomePage;