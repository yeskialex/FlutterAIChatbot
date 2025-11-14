import React, { useState } from 'react';
import './Sidebar.css';
import {
  HiChevronLeft,
  HiChevronRight,
  HiHome,
  HiPlus,
  HiSearch,
  HiX,
  HiTrash,
  HiLogout
} from 'react-icons/hi';

const Sidebar = ({
  user,
  onSignOut,
  onNewChat,
  onSelectConversation,
  currentConversationId,
  conversations,
  onDeleteConversation,
  onGoHome
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const formatDate = (timestamp) => {
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
      // Fallback to current date
      date = new Date();
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Recent';
    }

    const now = new Date();

    // Check if it's the same day (more reliable)
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysDiff = Math.floor((nowDate - compareDate) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Yesterday';
    if (daysDiff > 0 && daysDiff < 7) return `${daysDiff} days ago`;
    if (daysDiff < 0) return 'Future'; // Handle future dates

    return date.toLocaleDateString();
  };

  const truncateTitle = (title, maxLength = 30) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  const filterConversations = (conversations, query) => {
    if (!query.trim()) return conversations;

    const lowerQuery = query.toLowerCase();

    return conversations.filter(conv => {
      // Search in conversation title
      if (conv.title && conv.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in message contents
      if (conv.messages && conv.messages.length > 0) {
        return conv.messages.some(msg =>
          msg.content && msg.content.toLowerCase().includes(lowerQuery)
        );
      }

      return false;
    });
  };

  const groupConversationsByDate = (conversations) => {
    const groups = {};

    conversations.forEach(conv => {
      // Use updatedAt for more recent activity, fallback to createdAt
      const dateToUse = conv.updatedAt || conv.createdAt;
      const dateKey = formatDate(dateToUse);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(conv);
    });

    return groups;
  };

  const filteredConversations = filterConversations(conversations, searchQuery);
  const groupedConversations = groupConversationsByDate(filteredConversations);

  // Clean up: Remove debug logging
  // console.log('Sidebar - conversations prop:', conversations);

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="header-top">
          <button className="toggle-btn" onClick={toggleSidebar}>
            {isCollapsed ? <HiChevronRight /> : <HiChevronLeft />}
          </button>

          {!isCollapsed && (
            <button className="home-btn" onClick={onGoHome} title="Home">
              <HiHome />
            </button>
          )}
        </div>

        {!isCollapsed && (
          <button className="new-chat-btn" onClick={onNewChat}>
            <HiPlus className="icon" />
            New Chat
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
          <div className="search-container">
            <HiSearch className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <HiX />
              </button>
            )}
          </div>

          <div className="conversations-list">
            {Object.keys(groupedConversations).length === 0 ? (
              <div className="no-conversations">
                {searchQuery ? (
                  <>
                    <p>No results found</p>
                    <p>Try a different search term</p>
                  </>
                ) : (
                  <>
                    <p>No conversations yet</p>
                    <p>Start a new chat to begin!</p>
                  </>
                )}
              </div>
            ) : (
              Object.entries(groupedConversations).map(([dateGroup, convs]) => (
                <div key={dateGroup} className="conversation-group">
                  <div className="group-header">{dateGroup}</div>
                  {convs.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`conversation-item ${
                        currentConversationId === conversation.id ? 'active' : ''
                      }`}
                      onClick={() => onSelectConversation(conversation)}
                    >
                      <div className="conversation-content">
                        <div className="conversation-title">
                          {truncateTitle(conversation.title || 'New Chat')}
                        </div>
                        <div className="conversation-preview">
                          {conversation.messages && conversation.messages.length > 0
                            ? truncateTitle(conversation.messages[0].content, 40)
                            : 'No messages yet'}
                        </div>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
                            onDeleteConversation(conversation.id);
                          }
                        }}
                        title="Delete conversation"
                      >
                        <HiTrash />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.name || 'User'}</div>
                <div className="user-email">{user?.email}</div>
              </div>
            </div>
            <button className="sign-out-btn" onClick={onSignOut}>
              <HiLogout />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;