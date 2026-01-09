import React, { useState } from 'react';
import './AuthPage.css';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../firebase/authService';
import { HiCode, HiMail, HiLockClosed, HiUser } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import LanguageToggle from './LanguageToggle';

const AuthPage = ({ language = 'en', onLanguageChange }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Localized text
  const t = {
    en: {
      createAccount: 'Create Account',
      welcomeBack: 'Welcome Back',
      joinCommunity: 'Join the Flutter learning community',
      signInContinue: 'Sign in to continue your Flutter journey',
      fullName: 'Full Name',
      enterName: 'Enter your full name',
      email: 'Email Address',
      enterEmail: 'Enter your email',
      password: 'Password',
      enterPassword: 'Enter your password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your password',
      signUp: 'Create Account',
      signIn: 'Sign In',
      pleaseWait: 'Please wait...',
      or: 'or',
      continueGoogle: 'Continue with Google',
      alreadyAccount: 'Already have an account?',
      noAccount: "Don't have an account?",
    },
    ko: {
      createAccount: '계정 만들기',
      welcomeBack: '환영합니다',
      joinCommunity: 'Flutter 학습 커뮤니티에 참여하세요',
      signInContinue: 'Flutter 여정을 계속하려면 로그인하세요',
      fullName: '이름',
      enterName: '이름을 입력하세요',
      email: '이메일 주소',
      enterEmail: '이메일을 입력하세요',
      password: '비밀번호',
      enterPassword: '비밀번호를 입력하세요',
      confirmPassword: '비밀번호 확인',
      confirmPasswordPlaceholder: '비밀번호를 다시 입력하세요',
      signUp: '계정 만들기',
      signIn: '로그인',
      pleaseWait: '잠시만 기다려주세요...',
      or: '또는',
      continueGoogle: 'Google 계정으로 계속하기',
      alreadyAccount: '이미 계정이 있으신가요?',
      noAccount: '계정이 없으신가요?',
    }
  };

  const text = t[language] || t.en;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (formData.email && !formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (isSignUp) {
      if (!formData.name) {
        setError('Name is required for sign up');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      let result;

      if (isSignUp) {
        result = await signUpWithEmail(formData.email, formData.password, formData.name);
      } else {
        result = await signInWithEmail(formData.email, formData.password);
      }

      if (result.success) {
        // Firebase onAuthStateChanged will automatically handle the user state
        // No need to manually call onAuthSuccess or set localStorage
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithGoogle();

      if (result.success) {
        // Firebase onAuthStateChanged will automatically handle the user state
        // No need to manually call onAuthSuccess or set localStorage
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
  };

  return (
    <div className="auth-page">
      <div className="language-toggle-container">
        <LanguageToggle language={language} onLanguageChange={onLanguageChange} />
      </div>
      <div className="auth-container">
        <div className="auth-header">
          <h1>
            <HiCode className="header-icon" />
            Flutter AI Chatbot
          </h1>
          <h2>{isSignUp ? text.createAccount : text.welcomeBack}</h2>
          <p>{isSignUp ? text.joinCommunity : text.signInContinue}</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="name">{text.fullName}</label>
              <div className="input-wrapper">
                <HiUser className="input-icon" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder={text.enterName}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{text.email}</label>
            <div className="input-wrapper">
              <HiMail className="input-icon" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder={text.enterEmail}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">{text.password}</label>
            <div className="input-wrapper">
              <HiLockClosed className="input-icon" />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={text.enterPassword}
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="confirmPassword">{text.confirmPassword}</label>
              <div className="input-wrapper">
                <HiLockClosed className="input-icon" />
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder={text.confirmPasswordPlaceholder}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="auth-btn primary"
            disabled={loading}
          >
            {loading ? text.pleaseWait : (isSignUp ? text.signUp : text.signIn)}
          </button>

          <div className="divider">
            <span>{text.or}</span>
          </div>

          <button
            type="button"
            className="auth-btn google"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <FcGoogle className="google-icon" />
            {text.continueGoogle}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isSignUp ? text.alreadyAccount : text.noAccount}{' '}
            <button className="link-btn" onClick={toggleMode}>
              {isSignUp ? text.signIn : text.signUp}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;