'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import styles from './audit.module.css';

const ACTION_LABELS = {
  APPROVED_CLAIM: 'Approved Claim',
  REJECTED_CLAIM: 'Rejected Claim',
  DELETED_FOUND_ITEM: 'Deleted Found Item',
  DELETED_LOST_ITEM: 'Deleted Lost Item',
  ADDED_FOUND_ITEM: 'Added Found Item',
  ADDED_LOST_ITEM: 'Added Lost Item',
  RETURNED_ITEM: 'Returned Item',
  RESOLVED_ITEM: 'Resolved Item',
  MANUAL_MATCH: 'Manual Match Created',
  REVOKED_ADMIN: 'Revoked Admin',
  GRANTED_ADMIN: 'Granted Admin',
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter and pagination states
  const [adminFilter, setAdminFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, 'admin_history'), orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.error('Error fetching audit logs:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const uniqueAdmins = useMemo(() => {
    const admins = new Set(logs.map(log => log.adminName || log.adminId));
    return ['All', ...Array.from(admins).sort()];
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map(log => log.actionType));
    const filtered = Array.from(actions).filter(a => ACTION_LABELS[a]);
    return ['All', ...filtered.sort()];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    setCurrentPage(1); // Reset to page 1 on filter change
    return logs.filter(log => {
      const matchesAdmin = adminFilter === 'All' || (log.adminName || log.adminId) === adminFilter;
      const matchesAction = actionFilter === 'All' || log.actionType === actionFilter;
      
      let matchesDate = true;
      if (log.timestamp?.toDate) {
        const logDate = log.timestamp.toDate();
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) matchesDate = false;
        }
      }

      return matchesAdmin && matchesAction && matchesDate;
    });
  }, [logs, adminFilter, actionFilter, startDate, endDate]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleReset = () => {
    setAdminFilter('All');
    setActionFilter('All');
    setStartDate('');
    setEndDate('');
  };

  if (loading) return <div className={styles.emptyState}>Loading audit log...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>System Audit Log</h2>
        <span>
          {filteredLogs.length > 0 ? (
            `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of ${filteredLogs.length} Records`
          ) : (
            '0 Records'
          )}
        </span>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Administrator</label>
          <select 
            className={styles.filterInput}
            value={adminFilter}
            onChange={e => setAdminFilter(e.target.value)}
          >
            {uniqueAdmins.map(admin => <option key={admin} value={admin}>{admin}</option>)}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Action Type</label>
          <select 
            className={styles.filterInput}
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            {uniqueActions.map(action => (
              <option key={action} value={action}>
                {action === 'All' ? 'All Actions' : (ACTION_LABELS[action] || action)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>From Date</label>
          <input 
            type="date" 
            className={styles.filterInput}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>To Date</label>
          <input 
            type="date" 
            className={styles.filterInput}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Subject</th>
              <th>Item ID</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className={styles.emptyState}>No matching records found.</td>
              </tr>
            ) : (
              paginatedLogs.map(log => {
                const date = log.timestamp?.toDate
                  ? new Date(log.timestamp.toDate()).toLocaleString()
                  : 'Unknown';
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{date}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.adminName || log.adminId}</td>
                    <td>
                      <span className={styles.badge}>
                        {ACTION_LABELS[log.actionType] || log.actionType}
                      </span>
                    </td>
                    <td>{log.itemTitle || '—'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {log.itemId ? `${log.itemId.substring(0, 12)}...` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.pageInfo}>
            Page {currentPage} of {totalPages} ({filteredLogs.length} records)
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
    </div>
  );
}
