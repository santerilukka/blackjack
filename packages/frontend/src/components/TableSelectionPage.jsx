import { useState, useEffect } from 'react';
import { getTables } from '../services/api.js';
import './TableSelectionPage.css';

export default function TableSelectionPage({ user, onSelectTable, onLogout }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTables()
      .then(setTables)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="table-selection-page">
      <div className="table-selection-header">
        <h1>Choose a Table</h1>
        <p className="greeting">
          Welcome, <strong>{user.username}</strong>
          <span className="balance">Balance: ${user.balance}</span>
        </p>
      </div>

      {loading && <p className="table-loading">Loading tables...</p>}
      {error && <p className="table-error">{error}</p>}

      <div className="table-grid">
        {tables.map((table) => (
          <button
            key={table.id}
            className="table-card"
            onClick={() => onSelectTable(table.id)}
          >
            <h2>{table.name}</h2>
            <p className="table-description">
              {table.description.split('. ').map((sentence, i, arr) => (
                <span key={i}>{sentence}{i < arr.length - 1 ? '.' : ''}</span>
              ))}
            </p>
            <div className="table-details">
              <span className="table-bet-range">
                ${table.minBet} &ndash; ${table.maxBet}
              </span>
              <span className="table-players">
                {table.maxPlayers === 1 ? '1 Player' : `Up to ${table.maxPlayers} players`}
              </span>
            </div>
          </button>
        ))}
      </div>

      <button className="logout-btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
