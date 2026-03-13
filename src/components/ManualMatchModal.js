'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, addDoc, updateDoc, doc, serverTimestamp, query, where
} from 'firebase/firestore';
import styles from './modal.module.css';
import matchStyles from './match.module.css';

export default function ManualMatchModal({ isOpen, onClose, adminUser }) {
  const [lostItems, setLostItems]   = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [selectedLost, setSelectedLost]   = useState('');
  const [selectedFound, setSelectedFound] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      setLoading(true);
      const [lostSnap, foundSnap] = await Promise.all([
        getDocs(query(collection(db, 'lost_items'),  where('status', '==', 'lost'))),
        getDocs(query(collection(db, 'found_items'), where('status', '==', 'found'))),
      ]);
      setLostItems(lostSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFoundItems(foundSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, [isOpen]);

  const handleMatch = async () => {
    if (!selectedLost || !selectedFound) {
      alert('Please select both a lost item and a found item.');
      return;
    }
    setSaving(true);
    try {
      const lostItem  = lostItems.find(i => i.id === selectedLost);
      const foundItem = foundItems.find(i => i.id === selectedFound);

      // Create a claim record for the manual match
      await addDoc(collection(db, 'claims'), {
        userId: lostItem.userId,
        itemId: selectedFound,
        lostItemId: selectedLost,
        status: 'approved',
        manualMatch: true,
        matchedBy: adminUser?.uid || 'admin',
        timestamp: serverTimestamp(),
      });

      // Update statuses
      await updateDoc(doc(db, 'found_items', selectedFound), { status: 'returned' });
      await updateDoc(doc(db, 'lost_items',  selectedLost),  { status: 'resolved', claimedFoundItemId: selectedFound });

      // Log action
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: 'MANUAL_MATCH',
        itemTitle: `${lostItem?.name || 'Lost Item'} ↔ ${foundItem?.name || 'Found Item'}`,
        itemId: selectedFound,
        timestamp: serverTimestamp(),
      });

      alert('Manual match created successfully! Both items have been marked as resolved.');
      setSelectedLost('');
      setSelectedFound('');
      onClose();
    } catch (e) {
      console.error('Error creating manual match:', e);
      alert(`Failed to create match: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${matchStyles.matchModal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add Manual Match</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={matchStyles.matchBody}>
          <p className={matchStyles.hint}>
            Select a <strong>Lost Item</strong> and a <strong>Found Item</strong> to manually pair them.
            This will create an approved claim and mark both items as resolved.
          </p>

          {loading ? (
            <p className={matchStyles.hint}>Loading items...</p>
          ) : (
            <div className={matchStyles.selectGrid}>
              <div className={matchStyles.selectGroup}>
                <label>Lost Item</label>
                <select
                  value={selectedLost}
                  onChange={e => setSelectedLost(e.target.value)}
                  className={matchStyles.select}
                >
                  <option value="">-- Select a lost item --</option>
                  {lostItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category || 'Uncategorized'})
                    </option>
                  ))}
                </select>
              </div>

              <div className={matchStyles.matchArrow}>↔</div>

              <div className={matchStyles.selectGroup}>
                <label>Found Item</label>
                <select
                  value={selectedFound}
                  onChange={e => setSelectedFound(e.target.value)}
                  className={matchStyles.select}
                >
                  <option value="">-- Select a found item --</option>
                  {foundItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category || 'Uncategorized'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className={matchStyles.actions}>
            <button className={matchStyles.cancelBtn} onClick={onClose}>Cancel</button>
            <button
              className={matchStyles.confirmBtn}
              onClick={handleMatch}
              disabled={saving || loading || !selectedLost || !selectedFound}
            >
              {saving ? 'Matching...' : 'Confirm Match'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
