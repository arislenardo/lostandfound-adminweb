'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import styles from '../table.module.css';
import Image from 'next/image';
import ItemDetailModal from '@/components/ItemDetailModal';

export default function FoundItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchItems() {
      try {
        const itemsRef = collection(db, 'found_items');
        const q = query(itemsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const fetchedItems = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        
        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching found items:", error);
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

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this found item? This action cannot be undone.")) {
      return;
    }

    try {
      const itemRef = doc(db, 'found_items', itemId);
      await deleteDoc(itemRef);
      
      // Update local state to reflect UI immediately
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
    } catch (error) {
      console.error(`Error deleting item:`, error);
      alert(`Failed to delete item: ${error.message}`);
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Found Items...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Registry of Found Items</h2>
        <span>{items.length} Total Items</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Image</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Finder UID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No items have been reported found yet.</td>
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
                    <span className={styles.badge} style={{ backgroundColor: item.status === 'returned' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)', color: item.status === 'returned' ? 'var(--success)' : '#eab308' }}>
                      {item.status || 'Active'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.userId}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                       <button 
                         className={styles.actionBtn}
                         onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                       >
                         Edit/View
                       </button>
                       <button 
                         className={styles.actionBtn} 
                         style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                         onClick={() => handleDeleteItem(item.id)}
                       >
                         Delete
                       </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ItemDetailModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }} 
        item={selectedItem}
        type="found"
      />
    </div>
  );
}
