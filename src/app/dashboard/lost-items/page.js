'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import styles from '../table.module.css';
import Image from 'next/image';

export default function LostItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      try {
        const itemsRef = collection(db, 'lost_items');
        const q = query(itemsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedItems = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching lost items:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, []);

  const getCategoryClass = (category) => {
    const cat = (category || 'other').toLowerCase();
    switch (cat) {
      case 'electronics': return styles.electronics;
      case 'wallet': return styles.wallet;
      case 'keys': return styles.keys;
      case 'bags': return styles.bags;
      default: return styles.other;
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Lost Items...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Registry of Lost Items</h2>
        <span>{items.length} Total Reports</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Image Reference</th>
              <th>Reported Item Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Owner UID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No items have been reported lost yet.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.imageUrl ? (
                      <Image 
                        src={item.imageUrl} 
                        alt={item.name} 
                        width={48} 
                        height={48} 
                        className={styles.itemImage}
                        unoptimized
                      />
                    ) : (
                      <div className={styles.noImage}>N/A</div>
                    )}
                  </td>
                  <td>{item.name}</td>
                  <td>
                    <span className={`${styles.badge} ${getCategoryClass(item.category)}`}>
                      {item.category || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.badge} style={{ backgroundColor: item.status === 'resolved' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)', color: item.status === 'resolved' ? 'var(--success)' : '#eab308' }}>
                      {item.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.userId}</td>
                  <td>
                    <button className={styles.actionBtn}>View Details</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
