'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../table.module.css';
import Image from 'next/image';
import ItemDetailModal from '@/components/ItemDetailModal';

const CATEGORIES = [
  'All',
  'Backpacks / Bags',
  'Books / Notebooks',
  'Card',
  'Chargers / Cables',
  'Clothing',
  'Folder / Envelopes',
  'Glasses / Sunglasses',
  'Hats',
  'Headphones / Earbuds',
  'Keys',
  'Laptops',
  'Phone / Tablet',
  'Umbrellas',
  'Wallet',
  'Watch',
  'Water Bottles',
  'Others',
];

const STATUS_LABELS = {
  'found': 'Found',
  'pending': 'Pending',
  'claim_pending': 'Claim Pending',
  'added': 'Added',
  'returned': 'Returned',
  'all': 'All Statuses'
};

function getStatusStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'returned' || s === 'resolved' || s === 'claimed') return styles.statusReturned;
  if (s === 'pending' || s === 'claim_pending') return styles.statusPending;
  if (s === 'rejected') return styles.statusRejected;
  if (s === 'added') return styles.statusAdded;
  return styles.statusFound; // found → blue
}

export default function FoundItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const adminUser = auth.currentUser;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    async function fetchItems() {
      try {
        const q = query(collection(db, 'found_items'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setItems(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (error) {
        console.error("Error fetching found items:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    setCurrentPage(1); // Reset to page 1 on filter/search change
    return items.filter(item => {
      const matchesSearch = !search ||
        (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'All' ||
        (item.category || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === 'All' ||
        (item.status || '').toLowerCase() === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDeleteItem = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!window.confirm(`Delete "${item?.name || 'this item'}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'found_items', itemId));
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: 'DELETED_FOUND_ITEM',
        itemTitle: item?.name || 'Unknown Item',
        itemId,
        timestamp: serverTimestamp(),
      });
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (error) {
      alert(`Failed to delete item: ${error.message}`);
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Found Items...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Registry of Found Items</h2>
        <span>
          {filtered.length > 0 ? (
            `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} found items`
          ) : (
            '0 items'
          )}
        </span>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {['All', 'found', 'pending', 'claim_pending', 'added', 'returned'].map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s.toLowerCase()] || s}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Image</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Reported At</th>
              <th>Finder UID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyState}>No items match your filters.</td></tr>
            ) : (
              paginatedItems.map(item => (
                <tr key={item.id}>
                  <td>
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name || 'Item'} width={44} height={44} className={styles.itemImage} unoptimized />
                    ) : (
                      <div className={styles.noImage}>N/A</div>
                    )}
                  </td>
                  <td style={{ fontWeight: '500' }}>{item.name}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.categoryBadge}`}>
                      {item.category || 'Others'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${getStatusStyle(item.status)}`}>
                      {STATUS_LABELS[(item.status || 'found').toLowerCase()] || item.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {item.createdAt
                      ? new Date(item.createdAt.toDate?.() || item.createdAt).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })
                      : 'N/A'}
                  </td>
                  <td className={styles.idCell} title={item.userId}>{item.userId}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.actionBtn} onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}>
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

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            Page {currentPage} of {totalPages} ({filtered.length} items)
          </div>
          <div className={styles.pageControls}>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ItemDetailModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        type="found"
        onUpdate={(itemId, updatedFields) => {
          setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updatedFields } : i));
          setSelectedItem(prev => prev ? { ...prev, ...updatedFields } : prev);
        }}
      />
    </div>
  );
}
