import React, { useState } from 'react';
import './MessageBubble.css';

const MessageBubble = ({ message, language }) => {
  const [showSources, setShowSources] = useState(false);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatContent = (content) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  };

  if (message.type === 'user') {
    return (
      <div className="message-bubble user-message">
        <div className="message-content">
          <div
            className="message-text"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
          <div className="message-time">{formatTimestamp(message.timestamp)}</div>
        </div>
        <div className="message-avatar user-avatar">
          👤
        </div>
      </div>
    );
  }

  return (
    <div className="message-bubble bot-message">
      <div className="message-avatar bot-avatar">
        🤖
      </div>
      <div className="message-content">
        <div
          className={`message-text ${message.error ? 'error-message' : ''}`}
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />

        {message.confidence && (
          <div className="confidence-indicator">
            <span className="confidence-label">Confidence:</span>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${message.confidence * 100}%`,
                  backgroundColor: message.confidence > 0.8 ? '#4CAF50' :
                                   message.confidence > 0.6 ? '#FF9800' : '#f44336'
                }}
              />
            </div>
            <span className="confidence-value">{Math.round(message.confidence * 100)}%</span>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="sources-section">
            <button
              className="sources-toggle"
              onClick={() => setShowSources(!showSources)}
            >
              📚 Sources ({message.sources.length})
              <span className={`arrow ${showSources ? 'up' : 'down'}`}>▼</span>
            </button>

            {showSources && (
              <div className="sources-list">
                {message.sources.map((source, index) => (
                  <div key={index} className="source-item">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link"
                    >
                      <div className="source-title">{source.title}</div>
                      <div className="source-meta">
                        <span className="source-url">{source.url}</span>
                        {source.lastUpdated && (
                          <span className="source-date">
                            Updated: {source.lastUpdated}
                          </span>
                        )}
                        {source.similarity && (
                          <span className="source-similarity">
                            Relevance: {Math.round(source.similarity * 100)}%
                          </span>
                        )}
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="message-time">{formatTimestamp(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default MessageBubble;