import { useState, useRef, useEffect } from 'react';
import { login } from '../services/api.js';
import './WelcomePage.css';

export default function WelcomePage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (username.trim()) {
      setShowHint(false);
      return;
    }
    const timer = setTimeout(() => setShowHint(true), 5000);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username is required');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const userData = await login(trimmed);
      onLogin(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="welcome-page">
      <form className="welcome-card" onSubmit={handleSubmit}>
        <h1>Blackjack</h1>
        <p className="subtitle">Enter your name to play</p>
        <input
          ref={inputRef}
          className="login-input"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          disabled={loading}
        />
        <button className="play-btn" type="submit" disabled={loading || !username.trim()}>
          {loading ? 'Joining...' : <>Play <kbd>Enter</kbd></>}
        </button>
        {error && <p className="login-error">{error}</p>}
        {showHint && !username.trim() && (
          <p className="login-hint">
            No password needed, just pick a name to start playing.
            Balance is saved to your name, so you can pick up where you left off.
            This app runs locally on your machine. 
          </p>
        )}
      </form>
    </div>
  );
}
