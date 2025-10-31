import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';
import MessageBubble from './MessageBubble';
import LanguageToggle from './LanguageToggle';
import { addMessageToConversation } from '../firebase/chatService';

const ChatInterface = ({ conversation, onGoHome, onUpdateConversation, user, showBackButton = true }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('en');
  const messagesEndRef = useRef(null);

  // Localized messages
  const t = {
    en: {
      backButton: '← Back to Home',
      thinking: 'Flutter AI is thinking...',
      placeholder: 'Ask me anything about Flutter development...',
      send: 'Send',
      inputHelp: 'Press Enter to send, Shift+Enter for new line',
      errorMessage: 'Sorry, I encountered an error. Please try again.',
      apiConfigError: 'API URL is not configured. Please contact support.',
    },
    ko: {
      backButton: '← 홈으로 돌아가기',
      thinking: 'Flutter AI가 생각하고 있습니다...',
      placeholder: 'Flutter 개발에 대해 무엇이든 물어보세요...',
      send: '전송',
      inputHelp: 'Enter를 눌러 전송, Shift+Enter로 줄바꿈',
      errorMessage: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
      apiConfigError: 'API URL이 설정되지 않았습니다. 관리자에게 문의하세요.',
    },
  };

  const currentLang = t[language] || t.en;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load messages from conversation when it changes
    if (conversation && conversation.messages) {
      setMessages(conversation.messages);
    } else {
      setMessages([]);
    }
  }, [conversation]);

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

    // Save user message to Firestore immediately
    if (conversation?.id) {
      await addMessageToConversation(conversation.id, userMessage);
    }

    if (!isInitial) {
      setInputValue('');
    }
    setIsLoading(true);

    try {
      // Call generateAnswer API (real AI)
      const apiUrl = process.env.REACT_APP_API_BASE_URL;

      if (!apiUrl) {
        throw new Error(currentLang.apiConfigError);
      }

      const response = await fetch(apiUrl, {
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

      // Save bot message to Firestore immediately
      if (conversation?.id) {
        await addMessageToConversation(conversation.id, botMessage);
      }

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
        content: currentLang.errorMessage,
        error: true,
        timestamp: new Date()
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);

      // Save error message to Firestore immediately
      if (conversation?.id) {
        await addMessageToConversation(conversation.id, errorMessage);
      }
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
        {showBackButton && (
          <button className="back-btn" onClick={onGoHome}>
            {currentLang.backButton}
          </button>
        )}
        <div className="chat-title">
          <h2>{conversation?.title || 'Flutter Chat'}</h2>
          {conversation?.week && conversation?.week !== 'quick' && conversation?.week !== 'new' && (
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
            <span>{currentLang.thinking}</span>
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
            placeholder={currentLang.placeholder}
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="send-btn"
          >
            {currentLang.send}
          </button>
        </div>

        <div className="input-help">
          <span>{currentLang.inputHelp}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;