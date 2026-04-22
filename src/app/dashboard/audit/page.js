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

function AuditDetailModal({ isOpen, onClose, log }) {
  if (!isOpen || !log) return null;

  const date = log.timestamp?.toDate
    ? new Date(log.timestamp.toDate()).toLocaleString([], { dateStyle: 'full', timeStyle: 'medium' })
    : 'Unknown';

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(8px)',
  };

  const contentStyle = {
    backgroundColor: 'var(--surface)', borderRadius: '18px',
    width: '90%', maxWidth: '480px', padding: '2.5rem',
    position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
    border: '1px solid var(--border)',
  };

  const rowStyle = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.5rem' };
  const labelStyle = { fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 };
  const valueStyle = { color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 500 };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1.25rem', fontSize: '1.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >×</button>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)' }}>Log Entry Details</h2>

        <div style={rowStyle}>
          <span style={labelStyle}>Timestamp</span>
          <span style={valueStyle}>{date}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Administrator</span>
          <span style={valueStyle}>{log.adminName || log.adminId}</span>
          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>UID: {log.adminId}</span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>System Action</span>
          <span style={{ 
            display: 'inline-block', 
            padding: '0.35rem 0.8rem', 
            borderRadius: '999px', 
            fontSize: '0.8rem', 
            fontWeight: 800, 
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            backgroundColor: (['APPROVED_CLAIM', 'ADDED_FOUND_ITEM', 'ADDED_LOST_ITEM', 'RETURNED_ITEM', 'GRANTED_ADMIN'].includes(log.actionType)) ? 'var(--success-light)' :
                            (['REJECTED_CLAIM', 'DELETED_FOUND_ITEM', 'DELETED_LOST_ITEM', 'REVOKED_ADMIN'].includes(log.actionType)) ? 'var(--error-light)' :
                            (['MANUAL_MATCH', 'RESOLVED_ITEM'].includes(log.actionType)) ? 'var(--gold-light)' : 'rgba(0,0,0,0.05)',
            color: (['APPROVED_CLAIM', 'ADDED_FOUND_ITEM', 'ADDED_LOST_ITEM', 'RETURNED_ITEM', 'GRANTED_ADMIN'].includes(log.actionType)) ? 'var(--success-dark)' :
                   (['REJECTED_CLAIM', 'DELETED_FOUND_ITEM', 'DELETED_LOST_ITEM', 'REVOKED_ADMIN'].includes(log.actionType)) ? '#b91c1c' :
                   (['MANUAL_MATCH', 'RESOLVED_ITEM'].includes(log.actionType)) ? 'var(--brown)' : 'var(--text-muted)',
            width: 'fit-content'
          }}>
            {ACTION_LABELS[log.actionType] || log.actionType}
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Action Subject</span>
          <span style={valueStyle}>{log.itemTitle || 'Not registered'}</span>
        </div>

        {log.itemId && (
          <div style={rowStyle}>
            <span style={labelStyle}>Reference ID</span>
            <span style={{ ...valueStyle, fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.itemId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No matching records found.</td>
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
                      <span className={`${styles.badge} ${['APPROVED_CLAIM', 'ADDED_FOUND_ITEM', 'ADDED_LOST_ITEM', 'RETURNED_ITEM', 'GRANTED_ADMIN'].includes(log.actionType)
                          ? styles.badgeSuccess
                          : ['REJECTED_CLAIM', 'DELETED_FOUND_ITEM', 'DELETED_LOST_ITEM', 'REVOKED_ADMIN'].includes(log.actionType)
                            ? styles.badgeError
                            : ['MANUAL_MATCH', 'RESOLVED_ITEM'].includes(log.actionType)
                              ? styles.badgeWarning
                              : styles.badgeInfo
                        }`}>
                        {ACTION_LABELS[log.actionType] || log.actionType}
                      </span>
                    </td>
                    <td>{log.itemTitle || '—'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {log.itemId ? `${log.itemId.substring(0, 12)}...` : '—'}
                    </td>
                    <td>
                      <button
                        className={styles.actionBtn}
                        onClick={() => { setSelectedLog(log); setIsModalOpen(true); }}
                      >
                        View Details
                      </button>
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

      <AuditDetailModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedLog(null); }}
        log={selectedLog}
      />
    </div>
  );
}
