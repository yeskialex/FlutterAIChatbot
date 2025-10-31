import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import './MessageBubble.css';

const MessageBubble = ({ message, language }) => {
  const [showSources, setShowSources] = useState(false);

  const formatTimestamp = (timestamp) => {
    let date;

    // Handle different timestamp formats
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
      // Firestore timestamp object
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp) {
      // String or number timestamp
      date = new Date(timestamp);
    } else {
      // Fallback to current time
      date = new Date();
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Now';
    }

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Custom components for ReactMarkdown
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      return !inline && language ? (
        <div style={{ position: 'relative' }}>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
          <button
            className="copy-code-btn"
            onClick={() => {
              navigator.clipboard.writeText(String(children));
            }}
            title="Copy code"
          >
            📋
          </button>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  if (message.type === 'user') {
    return (
      <div className="message-bubble user-message">
        <div className="message-content">
          <div className="message-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
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
        <div className={`message-text ${message.error ? 'error-message' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

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