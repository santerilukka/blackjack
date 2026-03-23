import { useEffect, useRef } from 'react';
import { SHORTCUTS, CHIP_SHORTCUT_DESCRIPTION } from '@blackjack/shared';
import { logout } from '../../services/api.js';

export default function SideMenu({ open, onClose, balance, phase, username, onLogout }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (open && menuRef.current) {
      menuRef.current.focus();
    }
  }, [open]);

  function handleLogout() {
    logout().catch(() => {});
    onLogout();
  }

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
          if (e.key.toLowerCase() === SHORTCUTS.LOGOUT.key && onLogout) {
            e.preventDefault();
            handleLogout();
          }
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
              <tr><td><kbd>1</kbd>-<kbd>5</kbd></td><td>{CHIP_SHORTCUT_DESCRIPTION}</td></tr>
              {Object.values(SHORTCUTS).map(({ label, description }) => (
                <tr key={label}><td><kbd>{label}</kbd></td><td>{description}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        {onLogout && (
          <section className="side-menu-section">
            <button className="logout-btn" onClick={handleLogout}>
              Log Out <kbd>{SHORTCUTS.LOGOUT.label}</kbd>
            </button>
          </section>
        )}
      </nav>
    </>
  );
}
