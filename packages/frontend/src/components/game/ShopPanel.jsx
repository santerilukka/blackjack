import { useEffect, useRef, useState } from 'react';
import { SHOP_ITEMS } from '@blackjack/shared';
import { getShop, purchaseItem, equipItem } from '../../services/api.js';

const itemList = Object.values(SHOP_ITEMS);

export default function ShopPanel({ open, onClose, onUpdate }) {
  const panelRef = useRef(null);
  const [ownedItems, setOwnedItems] = useState([]);
  const [activeFelt, setActiveFelt] = useState('felt_green');
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
      setLoading(true);
      setError(null);
      getShop()
        .then((data) => {
          setOwnedItems(data.ownedItems);
          setActiveFelt(data.activeFelt);
          setCoins(data.coins);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [open]);

  async function handlePurchase(itemId) {
    setError(null);
    try {
      const result = await purchaseItem(itemId);
      setCoins(result.coins);
      setOwnedItems(result.ownedItems);
      setActiveFelt(result.activeFelt);
      onUpdate?.({ coins: result.coins, activeFelt: result.activeFelt });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEquip(itemId) {
    setError(null);
    try {
      const result = await equipItem(itemId);
      setActiveFelt(result.activeFelt);
      onUpdate?.({ activeFelt: result.activeFelt });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div
        className={`shop-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
      />
      <nav
        ref={panelRef}
        className={`shop-panel ${open ? 'open' : ''}`}
        tabIndex={-1}
        aria-label="Shop"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <button className="shop-panel-close" onClick={onClose} aria-label="Close shop">
          &times;
        </button>

        <section className="shop-header">
          <h3>Shop</h3>
          <p className="shop-coins">Coins: <strong>{coins}</strong></p>
          <p className="shop-hint">Earn coins by playing rounds — 10% of each bet, plus 50 bonus for blackjack!</p>
        </section>

        {error && <p className="shop-error">{error}</p>}

        {loading ? (
          <p className="shop-loading">Loading...</p>
        ) : (
          <section className="shop-items">
            <h4>Table Felt Colors</h4>
            {itemList.map((item) => {
              const owned = ownedItems.includes(item.id);
              const equipped = item.id === activeFelt;
              return (
                <div key={item.id} className={`shop-item ${equipped ? 'equipped' : ''}`}>
                  <span
                    className="shop-item-swatch"
                    style={{ backgroundColor: item.colors.fill }}
                  />
                  <div className="shop-item-info">
                    <span className="shop-item-name">{item.name}</span>
                    <span className="shop-item-price">
                      {item.price === 0 ? 'Free' : `${item.price} coins`}
                    </span>
                  </div>
                  <div className="shop-item-action">
                    {equipped ? (
                      <span className="shop-equipped-label">Equipped</span>
                    ) : owned ? (
                      <button className="shop-equip-btn" onClick={() => handleEquip(item.id)}>Equip</button>
                    ) : (
                      <button
                        className="shop-buy-btn"
                        disabled={coins < item.price}
                        onClick={() => handlePurchase(item.id)}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </nav>
    </>
  );
}
