import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';
import MessageBubble from './MessageBubble';
import LanguageToggle from './LanguageToggle';
import { addMessageToConversation } from '../firebase/chatService';
import { HiChevronLeft, HiPaperAirplane, HiLink, HiDocumentText, HiX } from 'react-icons/hi';

const ChatInterface = ({ conversation, onGoHome, onUpdateConversation, user, showBackButton = true, language = 'en', onLanguageChange }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Localized messages
  const t = {
    en: {
      backButton: 'Back to Home',
      thinking: 'Flutter AI is thinking...',
      placeholder: 'Ask me anything about Flutter development...',
      send: 'Send',
      inputHelp: 'Press Enter to send, Shift+Enter for new line',
      errorMessage: 'Sorry, I encountered an error. Please try again.',
      apiConfigError: 'API URL is not configured. Please contact support.',
      attachLink: 'Attach Link',
      attachFile: 'Attach File',
      linkPlaceholder: 'Enter URL (e.g., https://example.com)',
      removeLink: 'Remove link',
      removeFile: 'Remove file',
    },
    ko: {
      backButton: '홈으로 돌아가기',
      thinking: 'Flutter AI가 생각하고 있습니다...',
      placeholder: 'Flutter 개발에 대해 무엇이든 물어보세요...',
      send: '전송',
      inputHelp: 'Enter를 눌러 전송, Shift+Enter로 줄바꿈',
      errorMessage: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
      apiConfigError: 'API URL이 설정되지 않았습니다. 관리자에게 문의하세요.',
      attachLink: '링크 첨부',
      attachFile: '파일 첨부',
      linkPlaceholder: 'URL 입력 (예: https://example.com)',
      removeLink: '링크 제거',
      removeFile: '파일 제거',
    },
  };

  const currentLang = t[language] || t.en;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = textarea.scrollHeight;
      textarea.style.height = `${newHeight}px`;

      // Show scrollbar only when content exceeds max-height (120px)
      if (newHeight > 120) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
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
    // Adjust textarea height when input value changes
    adjustTextareaHeight();
  }, [inputValue]);

  useEffect(() => {
    // Send initial prompt if this is a new conversation
    if (conversation && conversation.initialPrompt && messages.length === 0) {
      handleSendMessage(conversation.initialPrompt, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Only allow text files
    const allowedTypes = ['.txt', '.md', '.dart', '.js', '.json', '.yaml', '.yml'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
      alert(language === 'ko'
        ? '텍스트 파일만 첨부 가능합니다 (.txt, .md, .dart, .js, .json, .yaml)'
        : 'Only text files are allowed (.txt, .md, .dart, .js, .json, .yaml)');
      return;
    }

    setAttachedFile(file);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveLink = () => {
    setLinkUrl('');
  };

  const readFileContent = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

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
      // Reset textarea height and hide scrollbar
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
    setIsLoading(true);

    try {
      // Read file content if file is attached
      let fileContent = null;
      let fileName = null;
      if (attachedFile && !isInitial) {
        fileContent = await readFileContent(attachedFile);
        fileName = attachedFile.name;
      }

      // Call generateAnswer API (real AI)
      const apiUrl = process.env.REACT_APP_API_BASE_URL;

      if (!apiUrl) {
        throw new Error(currentLang.apiConfigError);
      }

      const requestBody = {
        question: messageText,
        conversationId: conversation.id,
        language: language
      };

      // Add attachments if present
      if (linkUrl && !isInitial) {
        requestBody.linkUrl = linkUrl;
      }
      if (fileContent && !isInitial) {
        requestBody.fileContent = fileContent;
        requestBody.fileName = fileName;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

      // Clear attachments after successful send
      if (!isInitial) {
        setLinkUrl('');
        handleRemoveFile();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', error.message);
      console.error('API URL:', process.env.REACT_APP_API_BASE_URL);

      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `${currentLang.errorMessage}\n\nError: ${error.message}`,
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

  const handleRegenerate = async (messageId) => {
    // Find the bot message to regenerate
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Find the previous user message
    let userMessage = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) return;

    setIsLoading(true);

    try {
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
          question: userMessage.content,
          conversationId: conversation.id,
          language: language
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const newBotMessage = {
        id: Date.now(),
        type: 'bot',
        content: data.answer,
        sources: data.sources,
        confidence: data.confidence,
        timestamp: new Date()
      };

      // Replace the old message with the new one
      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = newBotMessage;
      setMessages(updatedMessages);

      // Update Firestore
      if (conversation?.id) {
        await addMessageToConversation(conversation.id, newBotMessage);
      }

      // Update conversation
      onUpdateConversation({
        ...conversation,
        messages: updatedMessages
      });

    } catch (error) {
      console.error('Error regenerating message:', error);

      const errorMessage = {
        id: Date.now(),
        type: 'bot',
        content: currentLang.errorMessage,
        error: true,
        timestamp: new Date()
      };

      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = errorMessage;
      setMessages(updatedMessages);

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
            <HiChevronLeft />
            {currentLang.backButton}
          </button>
        )}
        <div className="chat-title">
          <h2>{conversation?.title || 'Flutter Chat'}</h2>
          {conversation?.week && conversation?.week !== 'quick' && conversation?.week !== 'new' && (
            <span className="week-badge">Week {conversation.week}</span>
          )}
        </div>
        <LanguageToggle language={language} onLanguageChange={onLanguageChange} />
      </header>

      <div className="chat-messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            language={language}
            onRegenerate={handleRegenerate}
          />
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
        {/* Attachment toolbar */}
        <div className="attachment-toolbar">
          <button
            className="attachment-btn"
            onClick={() => setShowAttachments(!showAttachments)}
            title={currentLang.attachLink}
          >
            <HiLink />
          </button>
          <button
            className="attachment-btn"
            onClick={() => fileInputRef.current?.click()}
            title={currentLang.attachFile}
          >
            <HiDocumentText />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.dart,.js,.json,.yaml,.yml"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Link input (shown when attachments button clicked) */}
        {showAttachments && (
          <div className="link-input-container">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={currentLang.linkPlaceholder}
              className="link-input"
            />
          </div>
        )}

        {/* Show attached items */}
        {(linkUrl || attachedFile) && (
          <div className="attached-items">
            {linkUrl && (
              <div className="attached-item">
                <HiLink />
                <span className="attached-item-text">{linkUrl}</span>
                <button onClick={handleRemoveLink} className="remove-attachment">
                  <HiX />
                </button>
              </div>
            )}
            {attachedFile && (
              <div className="attached-item">
                <HiDocumentText />
                <span className="attached-item-text">{attachedFile.name}</span>
                <button onClick={handleRemoveFile} className="remove-attachment">
                  <HiX />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="chat-input">
          <textarea
            ref={textareaRef}
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
            <HiPaperAirplane />
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