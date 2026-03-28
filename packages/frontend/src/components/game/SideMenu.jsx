import { useEffect, useRef } from 'react';
import { SHORTCUTS, CHIP_SHORTCUT_DESCRIPTION } from '@blackjack/shared';
import { logout } from '../../services/api.js';

export default function SideMenu({ open, onClose, balance, phase, username, onLogout, onLeaveTable, volume, muted, onVolumeChange, onMuteToggle }) {
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
          <h3>Sound</h3>
          <div className="sound-controls">
            <button
              className={`mute-btn ${muted ? 'muted' : ''}`}
              onClick={onMuteToggle}
            >
              {muted ? (
                <svg className="mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg className="mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
              {muted ? 'Muted' : 'Sound On'}
              <kbd>{SHORTCUTS.MUTE.label}</kbd>
            </button>
            <label className="volume-label">
              <span className="volume-text">Volume <kbd>+</kbd> <kbd>-</kbd></span>
              <input
                className="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                disabled={muted}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              />
            </label>
          </div>
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
              {Object.entries(SHORTCUTS).map(([id, { label, description }]) => (
                <tr key={id}><td><kbd>{label}</kbd></td><td>{description}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="side-menu-section">
          {onLeaveTable && (
            <button className="leave-table-btn" onClick={onLeaveTable}>
              Change Table
            </button>
          )}
          {onLogout && (
            <button className="logout-btn" onClick={handleLogout}>
              Log Out <kbd>{SHORTCUTS.LOGOUT.label}</kbd>
            </button>
          )}
        </section>
      </nav>
    </>
  );
}
