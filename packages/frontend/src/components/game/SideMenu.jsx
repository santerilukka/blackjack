import { useEffect, useRef } from 'react';
import { logout } from '../../services/api.js';

export default function SideMenu({ open, onClose, balance, phase, username, onLogout }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (open && menuRef.current) {
      menuRef.current.focus();
    }
  }, [open]);

  return (
    <>
      <div
        className={`side-menu-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
      />
      <nav
        ref={menuRef}
        className={`side-menu ${open ? 'open' : ''}`}
        tabIndex={-1}
        aria-label="Game menu"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <button className="side-menu-close" onClick={onClose} aria-label="Close menu">
          &times;
        </button>

        <section className="side-menu-section">
          <h3>Player Info</h3>
          {username && <p>Player: <strong>{username}</strong></p>}
          <p>Balance: <strong>${balance}</strong></p>
          <p>Phase: <strong>{phase}</strong></p>
        </section>

        <section className="side-menu-section">
          <h3>How to Play</h3>
          <ol>
            <li>Place a bet using the chip selector</li>
            <li>Click <strong>Hit</strong> to draw a card</li>
            <li>Click <strong>Stand</strong> to end your turn</li>
            <li>Click <strong>Double</strong> to double your bet and draw one final card</li>
            <li>Beat the dealer without going over 21</li>
          </ol>
        </section>

        <section className="side-menu-section">
          <h3>Blackjack Rules</h3>
          <ul>
            <li>Cards 2-10 are worth face value</li>
            <li>J, Q, K are worth 10</li>
            <li>Aces are worth 11 or 1</li>
            <li>Blackjack (Ace + 10-value) pays 3:2</li>
            <li>Dealer hits on soft 17</li>
            <li>Double down on first two cards only</li>
            <li>Push returns your bet</li>
          </ul>
        </section>

        <section className="side-menu-section">
          <h3>Keyboard Shortcuts</h3>
          <table className="shortcut-table">
            <tbody>
              <tr><td><kbd>1</kbd>-<kbd>5</kbd></td><td>Select chip ($5-$100)</td></tr>
              <tr><td><kbd>B</kbd></td><td>Place bet / deal</td></tr>
              <tr><td><kbd>H</kbd></td><td>Hit</td></tr>
              <tr><td><kbd>S</kbd></td><td>Stand</td></tr>
              <tr><td><kbd>D</kbd></td><td>Double</td></tr>
              <tr><td><kbd>N</kbd></td><td>New round</td></tr>
              <tr><td><kbd>M</kbd></td><td>Toggle menu</td></tr>
            </tbody>
          </table>
        </section>

        {onLogout && (
          <section className="side-menu-section">
            <button
              className="logout-btn"
              onClick={async () => {
                try { await logout(); } catch {}
                onLogout();
              }}
            >
              Log Out
            </button>
          </section>
        )}
      </nav>
    </>
  );
}
