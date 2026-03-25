'use client';

import { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendClaimStatusNotification } from '@/lib/emailService';
import styles from '../table.module.css';

function ClaimDetailModal({ isOpen, onClose, claim }) {
  if (!isOpen || !claim) return null;

  const dateObj = claim.timestamp
    ? (claim.timestamp.toDate ? claim.timestamp.toDate() : new Date(claim.timestamp))
    : null;
  const date = dateObj
    ? dateObj.toLocaleString('en-US', { hour12: true, month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })
    : 'Unknown';

  const statusColors = {
    approved: { bg: 'var(--success-light)', color: 'var(--success-dark)' },
    rejected: { bg: 'var(--error-light)', color: '#b91c1c' },
    pending:  { bg: 'var(--warning-light)', color: '#c86037ff' },
  };
  const sc = statusColors[(claim.status || 'pending').toLowerCase()] || statusColors.pending;

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(92,61,30,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  };
  const contentStyle = {
    backgroundColor: 'var(--surface)', borderRadius: '14px',
    width: '90%', maxWidth: '540px', padding: '2rem',
    position: 'relative', boxShadow: '0 25px 50px -12px rgba(92,61,30,0.25)',
    border: '1px solid var(--border)',
  };
  const rowStyle = { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' };
  const labelStyle = { fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 };
  const valueStyle = { color: 'var(--foreground)', fontSize: '0.925rem' };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1.25rem', fontSize: '1.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
        >×</button>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>Claim Details</h2>

        <div style={rowStyle}>
          <span style={labelStyle}>Claim ID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{claim.id}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Found Item ID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{claim.itemId || '—'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Claimant UID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>{claim.userId || '—'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span style={{ display: 'inline-block', padding: '0.25rem 0.8rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color }}>
            {claim.status || 'Pending'}
          </span>
        </div>
        {claim.manualMatch && (
          <div style={rowStyle}>
            <span style={labelStyle}>Match Type</span>
            <span style={valueStyle}>Manual Match (Admin)</span>
          </div>
        )}
        <div style={rowStyle}>
          <span style={labelStyle}>Date Filed</span>
          <span style={valueStyle}>{date}</span>
        </div>
        {claim.description && (
          <div style={rowStyle}>
            <span style={labelStyle}>Description</span>
            <span style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>{claim.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_FILTERS = ['All', 'pending', 'approved', 'rejected', 'returned'];

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    async function fetchClaims() {
      try {
        // Fetch all claims without orderBy to avoid exclusion of docs without timestamp
        const snap = await getDocs(collection(db, 'claims'));
        const allClaims = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        
        // Sort in-memory to be more robust
        allClaims.sort((a, b) => {
          const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : (a.timestamp || 0);
          const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : (b.timestamp || 0);
          return timeB - timeA;
        });

        setClaims(allClaims);
      } catch (error) {
        console.error("Error fetching claims:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, []);

  const filteredClaims = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    if (statusFilter === 'All') return claims;
    return claims.filter(c => (c.status || 'pending').toLowerCase() === statusFilter);
  }, [claims, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredClaims.length / ITEMS_PER_PAGE);
  const paginatedClaims = filteredClaims.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleUpdateStatus = async (claimId, newStatus) => {
    const claim = claims.find(c => c.id === claimId);
    const adminUser = auth.currentUser;
    if (!claim) return;

    try {
      // 1. Update the claim document
      await updateDoc(doc(db, 'claims', claimId), { 
        status: newStatus,
        resolvedAt: serverTimestamp(),
        resolvedBy: adminUser?.uid || 'admin'
      });

      // 2. If approved, ALSO update the items in found_items/lost_items
      if (newStatus === 'approved' && claim.itemId) {
        await updateDoc(doc(db, 'found_items', claim.itemId), { status: 'returned' });
        
        // If it was a manual match or has lostItemId, resolve that too
        if (claim.lostItemId) {
          await updateDoc(doc(db, 'lost_items', claim.lostItemId), { 
            status: 'resolved',
            claimedFoundItemId: claim.itemId 
          });
        }
      }

      // 3. Log to admin history
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: newStatus === 'approved' ? 'APPROVED_CLAIM' : 'REJECTED_CLAIM',
        itemTitle: `Claim for item ${claim?.itemId?.substring(0, 8) || '?'}`,
        itemId: claim?.itemId || claimId,
        timestamp: serverTimestamp(),
      });

      // 4. Trigger email notification to the claimant
      if (claim.userEmail) {
        await sendClaimStatusNotification(
          claim.userEmail,
          claim.itemName || "Item",
          newStatus
        );
      }

      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c));
      alert(`Claim ${newStatus} successfully.`);
    } catch (error) {
      console.error("Error updating claim:", error);
      alert(`Failed to update claim: ${error.message}`);
    }
  };

  const openDetail = (claim) => {
    setSelectedClaim(claim);
    setIsDetailOpen(true);
  };

  const getStatusClass = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved' || s === 'returned') return `${styles.badge} ${styles.statusApproved}`;
    if (s === 'rejected') return `${styles.badge} ${styles.statusRejected}`;
    return `${styles.badge} ${styles.statusPending}`;
  };

  if (loading) return <div className={styles.emptyState}>Loading Claims...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Claim Resolution Hub</h2>
        <span>
          {filteredClaims.length > 0 ? (
            `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1} - ${Math.min(currentPage * ITEMS_PER_PAGE, filteredClaims.length)} of ${filteredClaims.length} claims`
          ) : (
            '0 claims'
          )}
        </span>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <select className={styles.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_FILTERS.map(s => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Found Item ID</th>
              <th>Claimant UID</th>
              <th>Status</th>
              <th>Date Filed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClaims.length === 0 ? (
              <tr><td colSpan="6" className={styles.emptyState}>No claims found.</td></tr>
            ) : (
              paginatedClaims.map(claim => {
                const date = claim.timestamp
                  ? new Date(claim.timestamp.toDate?.() || claim.timestamp).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })
                  : 'Unknown';
                return (
                  <tr key={claim.id}>
                    <td className={styles.idCell} title={claim.id}>{claim.id}</td>
                    <td className={styles.idCell} title={claim.itemId}>{claim.itemId || '—'}</td>
                    <td className={styles.idCell} title={claim.userId}>{claim.userId || '—'}</td>
                    <td>
                      <span className={getStatusClass(claim.status)}>
                        {claim.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{date}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {claim.status === 'pending' || !claim.status || claim.status === 'claim_pending' ? (
                          <>
                            <button
                              className={styles.actionBtn}
                              style={{ borderColor: 'var(--success)', color: 'var(--success-dark)' }}
                              onClick={() => handleUpdateStatus(claim.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className={styles.actionBtn}
                              style={{ borderColor: 'var(--error)', color: '#b91c1c' }}
                              onClick={() => handleUpdateStatus(claim.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button
                          className={styles.actionBtn}
                          onClick={() => openDetail(claim)}
                        >
                          View Details
                        </button>
                      </div>
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
            Page {currentPage} of {totalPages} ({filteredClaims.length} records)
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

      <ClaimDetailModal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedClaim(null); }}
        claim={selectedClaim}
      />
    </div>
  );
}
