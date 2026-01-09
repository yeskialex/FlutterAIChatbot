import React, { useState, useEffect } from 'react';
import './ChatLayout.css';
import Sidebar from './Sidebar';
import ChatInterface from './ChatInterface';
import HomePage from './HomePage';
import {
  createConversation,
  getUserConversations,
  updateConversation,
  deleteConversation,
  generateConversationTitle
} from '../firebase/chatService';
import { createTestConversations, testConversationRetrieval } from '../firebase/testConversations';

const ChatLayout = ({ user, onSignOut, language, onLanguageChange }) => {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [currentView, setCurrentView] = useState('home');
  const [loading, setLoading] = useState(true);

  // Load conversations from Firestore on mount
  useEffect(() => {
    const loadConversations = async () => {
      if (user?.id) {
        setLoading(true);
        const result = await getUserConversations(user.id);
        if (result.success) {
          setConversations(result.conversations);
        } else {
          console.error('Failed to load conversations:', result.error);
        }
        setLoading(false);
      }
    };

    loadConversations();
  }, [user?.id]);

  const createNewChat = async (initialData = null) => {
    if (!user?.id) return null;

    const title = initialData?.title || 'New Chat';
    const initialPrompt = initialData?.initialPrompt;

    const result = await createConversation(user.id, title, initialPrompt);
    if (result.success) {
      const newConversation = {
        ...result.conversation,
        week: initialData?.week,
        initialPrompt: initialData?.initialPrompt
      };

      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      setCurrentView('chat');

      return newConversation;
    } else {
      console.error('Failed to create conversation:', result.error);
      return null;
    }
  };

  const handleStartConversation = async (weekData) => {
    const newConv = await createNewChat({
      title: weekData.title,
      week: weekData.week,
      initialPrompt: weekData.initialPrompt
    });
    if (newConv) {
      setCurrentConversation(newConv);
      setCurrentView('chat');
    }
  };

  const handleSelectConversation = (conversation) => {
    setCurrentConversation(conversation);
    setCurrentView('chat');
  };

  const handleUpdateConversation = async (updatedConversation) => {
    // Update in Firestore
    const result = await updateConversation(updatedConversation.id, {
      messages: updatedConversation.messages,
      title: updatedConversation.title
    });

    if (result.success) {
      // Update local state
      setConversations(prev =>
        prev.map(conv =>
          conv.id === updatedConversation.id
            ? { ...updatedConversation, updatedAt: new Date() }
            : conv
        )
      );
      setCurrentConversation(updatedConversation);

      // Update title if it's still "New Chat" and we have messages
      if (
        updatedConversation.title === 'New Chat' &&
        updatedConversation.messages.length > 0
      ) {
        const firstUserMessage = updatedConversation.messages.find(m => m.type === 'user');
        if (firstUserMessage) {
          const newTitle = generateConversationTitle(firstUserMessage);
          const conversationWithTitle = {
            ...updatedConversation,
            title: newTitle
          };

          // Update title in Firestore
          await updateConversation(updatedConversation.id, { title: newTitle });

          setConversations(prev =>
            prev.map(conv =>
              conv.id === updatedConversation.id ? conversationWithTitle : conv
            )
          );
          setCurrentConversation(conversationWithTitle);
        }
      }
    } else {
      console.error('Failed to update conversation:', result.error);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    const result = await deleteConversation(conversationId);

    if (result.success) {
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setCurrentView('home');
      }
    } else {
      console.error('Failed to delete conversation:', result.error);
    }
  };

  const handleGoHome = () => {
    setCurrentView('home');
    setCurrentConversation(null);
  };

  // Debug function to test conversation functionality
  const handleTestConversations = async () => {
    console.log('Testing conversations...');
    await createTestConversations(user.id);

    // Reload conversations after creating test data
    const result = await getUserConversations(user.id);
    if (result.success) {
      setConversations(result.conversations);
    }
  };

  const handleTestRetrieval = async () => {
    console.log('Testing conversation retrieval...');
    const result = await testConversationRetrieval(user.id);
    console.log('Test retrieval result:', result);
  };

  // Show loading while conversations are being fetched
  if (loading) {
    return (
      <div className="chat-layout">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <Sidebar
        user={user}
        onSignOut={onSignOut}
        onNewChat={() => createNewChat()}
        onSelectConversation={handleSelectConversation}
        currentConversationId={currentConversation?.id}
        conversations={conversations}
        onDeleteConversation={handleDeleteConversation}
        onGoHome={handleGoHome}
      />

      <div className="main-content">
        {currentView === 'home' ? (
          <div className="home-wrapper">
            <HomePage
              onStartConversation={handleStartConversation}
              user={user}
              onSignOut={onSignOut}
              isCompact={true} // Add compact mode for sidebar layout
              onTestConversations={handleTestConversations}
              onTestRetrieval={handleTestRetrieval}
              language={language}
              onLanguageChange={onLanguageChange}
            />
          </div>
        ) : (
          <ChatInterface
            conversation={currentConversation}
            onGoHome={handleGoHome}
            onUpdateConversation={handleUpdateConversation}
            user={user}
            showBackButton={false} // Remove back button since we have sidebar
            language={language}
            onLanguageChange={onLanguageChange}
          />
        )}
      </div>
    </div>
  );
};

export default ChatLayout;