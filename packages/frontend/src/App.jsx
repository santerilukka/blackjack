import { useState, useEffect } from 'react';
import { getMe } from './services/api.js';
import WelcomePage from './components/WelcomePage.jsx';
import GamePage from './components/game/GamePage.jsx';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On mount, try to resume an existing session via GET /api/me
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((err) => {
        if (err.status !== 401) console.error('Failed to check session:', err);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="app" style={{ textAlign: 'center', paddingTop: '40vh' }}>Loading...</div>;
  }

  if (!user) {
    return <WelcomePage onLogin={setUser} />;
  }

  return (
    <div className="app">
      <GamePage user={user} onLogout={() => setUser(null)} />
    </div>
  );
}

export default App;
