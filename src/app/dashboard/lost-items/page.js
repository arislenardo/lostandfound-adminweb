'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../table.module.css';
import Image from 'next/image';
import ItemDetailModal from '@/components/ItemDetailModal';
import ExportModal from '@/components/ExportModal';
import { exportToPDF, exportToExcel } from '@/lib/reportUtils';

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
  'lost': 'Lost',
  'pending': 'Pending',
  'claim_pending': 'Claim Pending',
  'resolved': 'Resolved',
  'returned': 'Returned',
  'all': 'All Statuses'
};

/**
 * Returns the appropriate CSS class for a given status badge.
 * @param {string} status - The status of the lost item.
 * @returns {string} The CSS class name from table.module.css.
 */
function getStatusStyle(status) {
  const s = (status || '').toLowerCase();
  if (s === 'resolved' || s === 'returned' || s === 'claimed') return styles.statusResolved;
  if (s === 'pending' || s === 'claim_pending') return styles.statusPending;
  if (s === 'rejected') return styles.statusRejected;
  return styles.statusLost; // lost → blue
}

/**
 * Page component for displaying and managing the registry of lost items.
 * @returns {JSX.Element} The rendered Lost Items dashboard page.
 */
export default function LostItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const adminUser = auth.currentUser;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    /**
     * Fetches the latest lost items from the Firestore 'lost_items' collection,
     * ordered by creation date (newest first).
     */
    async function fetchItems() {
      try {
        const q = query(collection(db, 'lost_items'), orderBy('createdAt', 'desc'));
        
        const [snap, usersSnap] = await Promise.all([
          getDocs(q),
          getDocs(collection(db, 'users'))
        ]);
        
        const usersMap = {};
        usersSnap.forEach(doc => {
          usersMap[doc.id] = doc.data().email || 'No Email';
        });

        const fetchedItems = snap.docs.map(d => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            userEmail: usersMap[data.userId] || data.userId // Fallback to UID if email not found
          };
        });
        
        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching lost items:", error);
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

      let matchesDate = true;
      if (item.createdAt) {
        const itemDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (itemDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (itemDate > end) matchesDate = false;
        }
      } else if (startDate || endDate) {
        matchesDate = false;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesDate;
    });
  }, [items, search, categoryFilter, statusFilter, startDate, endDate]);

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
      await deleteDoc(doc(db, 'lost_items', itemId));
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: 'DELETED_LOST_ITEM',
        itemTitle: item?.name || 'Unknown Item',
        itemId,
        timestamp: serverTimestamp(),
      });
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (error) {
      alert(`Failed to delete item: ${error.message}`);
    }
  };

  const handleExport = (startDate, endDate, format) => {
    let exportData = items;
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      exportData = exportData.filter(item => {
        if (!item.createdAt) return false;
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        return d >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      exportData = exportData.filter(item => {
        if (!item.createdAt) return false;
        const d = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
        return d <= end;
      });
    }

    const columns = [
      { header: 'ID', key: 'id' },
      { header: 'Item Name', key: 'name' },
      { header: 'Category', key: 'category' },
      { header: 'Status', key: 'status' },
      { header: 'Reported At', key: 'formattedDate' },
      { header: 'Owner Email', key: 'userEmail' },
    ];

    const dataToExport = exportData.map(item => ({
      ...item,
      formattedDate: item.createdAt 
        ? new Date(item.createdAt.toDate?.() || item.createdAt).toLocaleString() 
        : 'N/A'
    }));

    if (format === 'pdf') {
      exportToPDF('Lost Items Report', columns, dataToExport, 'lost_items_report');
    } else {
      exportToExcel('Lost Items Report', columns, dataToExport, 'lost_items_report');
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Lost Items...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2>Registry of Lost Items</h2>
            <span>
              {filtered.length > 0 ? (
                `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} reports`
              ) : (
                '0 reports'
              )}
            </span>
          </div>
          <button 
            className={styles.actionBtn} 
            style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.5rem 1rem' }}
            onClick={() => setIsExportModalOpen(true)}
          >
            Export Report
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Search</label>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Category</label>
          <select className={styles.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status</label>
          <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {['All', 'lost', 'pending', 'claim_pending', 'resolved', 'returned'].map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s.toLowerCase()] || s}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Start Date</label>
          <input
            type="date"
            className={styles.searchInput}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>End Date</label>
          <input
            type="date"
            className={styles.searchInput}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <button
          className={styles.actionBtn}
          style={{ padding: '0.5rem 1rem', alignSelf: 'flex-end', height: '38px' }}
          onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All'); setStartDate(''); setEndDate(''); }}
        >
          Reset
        </button>
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
              <th>Owner Email</th>
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
                      {STATUS_LABELS[(item.status || 'lost').toLowerCase()] || item.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {item.createdAt
                      ? new Date(item.createdAt.toDate?.() || item.createdAt).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })
                      : 'N/A'}
                  </td>
                  <td className={styles.idCell} title={item.userId}>{item.userEmail || item.userId}</td>
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
            Page {currentPage} of {totalPages} ({filtered.length} reports)
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
        type="lost"
        onUpdate={(itemId, updatedFields) => {
          setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...updatedFields } : i));
          setSelectedItem(prev => prev ? { ...prev, ...updatedFields } : prev);
        }}
      />

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        title="Export Lost Items"
      />
    </div>
  );
}
