import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';
import MessageBubble from './MessageBubble';
import LanguageToggle from './LanguageToggle';

const ChatInterface = ({ conversation, onGoHome, onUpdateConversation }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Send initial prompt if this is a new conversation
    if (conversation && conversation.initialPrompt && messages.length === 0) {
      handleSendMessage(conversation.initialPrompt, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  const handleSendMessage = async (messageText = inputValue, isInitial = false) => {
    if (!messageText.trim() && !isInitial) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    if (!isInitial) {
      setInputValue('');
    }
    setIsLoading(true);

    try {
      // Call mockRAG API
      const response = await fetch('https://us-central1-hi-project-flutter-chatbot.cloudfunctions.net/mockRAG', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: messageText,
          conversationId: conversation.id,
          language: language
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence,
        timestamp: new Date()
      };

      const updatedMessages = [...newMessages, botMessage];
      setMessages(updatedMessages);

      // Update conversation
      onUpdateConversation({
        ...conversation,
        messages: updatedMessages
      });

    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true,
        timestamp: new Date()
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <header className="chat-header">
        <button className="back-btn" onClick={onGoHome}>
          ← Back to Home
        </button>
        <div className="chat-title">
          <h2>{conversation?.title || 'Flutter Chat'}</h2>
          {conversation?.week && conversation?.week !== 'quick' && (
            <span className="week-badge">Week {conversation.week}</span>
          )}
        </div>
        <LanguageToggle language={language} onLanguageChange={setLanguage} />
      </header>

      <div className="chat-messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} language={language} />
        ))}

        {isLoading && (
          <div className="loading-message">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Flutter AI is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about Flutter development..."
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="send-btn"
          >
            Send
          </button>
        </div>

        <div className="input-help">
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;