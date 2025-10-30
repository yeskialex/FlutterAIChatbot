import React from 'react';
import './LanguageToggle.css';

const LanguageToggle = ({ language, onLanguageChange }) => {
  return (
    <div className="language-toggle">
      <button
        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => onLanguageChange('en')}
      >
        🇺🇸 EN
      </button>
      <button
        className={`lang-btn ${language === 'ko' ? 'active' : ''}`}
        onClick={() => onLanguageChange('ko')}
      >
        🇰🇷 KO
      </button>
    </div>
  );
};

export default LanguageToggle;