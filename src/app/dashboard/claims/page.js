'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import styles from '../table.module.css';

function ClaimDetailModal({ isOpen, onClose, claim }) {
  if (!isOpen || !claim) return null;

  const dateObj = claim.timestamp
    ? (claim.timestamp.toDate ? claim.timestamp.toDate() : new Date(claim.timestamp))
    : null;
  const date = dateObj
    ? dateObj.toLocaleString('en-US', {
        hour12: true, month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: 'numeric',
      })
    : 'Unknown';

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  };
  const contentStyle = {
    backgroundColor: 'var(--surface)', borderRadius: '12px',
    width: '90%', maxWidth: '520px', padding: '2rem',
    position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    border: '1px solid var(--border)',
  };
  const rowStyle = { display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' };
  const labelStyle = { fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
  const valueStyle = { color: 'var(--text)', fontSize: '0.95rem', wordBreak: 'break-all' };

  const statusColors = {
    approved: { bg: 'rgba(34,197,94,0.1)', color: 'var(--success)' },
    rejected: { bg: 'rgba(239,68,68,0.1)', color: 'var(--error)' },
    pending: { bg: 'rgba(234,179,8,0.1)', color: '#eab308' },
  };
  const sc = statusColors[claim.status] || statusColors.pending;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1.5rem', fontSize: '2rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >×</button>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.15rem', fontWeight: 700 }}>Claim Details</h2>

        <div style={rowStyle}>
          <span style={labelStyle}>Claim ID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace' }}>{claim.id}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Item ID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace' }}>{claim.itemId || '—'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Claimant UID</span>
          <span style={{ ...valueStyle, fontFamily: 'monospace' }}>{claim.userId || '—'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Status</span>
          <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color }}>
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
            <span style={valueStyle}>{claim.description}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    async function fetchClaims() {
      try {
        const claimsRef = collection(db, 'claims');
        const q = query(claimsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);

        const fetchedClaims = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));

        setClaims(fetchedClaims);
      } catch (error) {
        console.error("Error fetching claims:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchClaims();
  }, []);

  const handleUpdateStatus = async (claimId, newStatus) => {
    const claim = claims.find(c => c.id === claimId);
    const adminUser = auth.currentUser;
    try {
      await updateDoc(doc(db, 'claims', claimId), { status: newStatus });
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: newStatus === 'approved' ? 'APPROVED_CLAIM' : 'REJECTED_CLAIM',
        itemTitle: `Claim for item ${claim?.itemId?.substring(0, 8) || '?'}`,
        itemId: claim?.itemId || claimId,
        timestamp: serverTimestamp(),
      });
      setClaims(prev =>
        prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c)
      );
    } catch (error) {
      console.error(`Error updating claim to ${newStatus}:`, error);
      alert(`Failed to update claim: ${error.message}`);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'approved': return { bg: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' };
      case 'rejected': return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' };
      case 'pending': default: return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
    }
  };

  if (loading) return <div className={styles.emptyState}>Loading Claims...</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2>Claim Resolution Hub</h2>
        <span>{claims.length} Total Claims</span>
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
              <th>Admin Action</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.emptyState}>No claims have been filed yet.</td>
              </tr>
            ) : (
              claims.map((claim) => {
                const statusStyle = getStatusClass(claim.status);
                const date = claim.timestamp ? new Date(claim.timestamp.toDate?.() || claim.timestamp).toLocaleString('en-US', { hour12: true, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }) : 'Unknown';

                return (
                  <tr key={claim.id}>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{claim.id.substring(0, 8)}...</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{claim.itemId?.substring(0, 8)}...</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{claim.userId}</td>
                    <td>
                      <span className={styles.badge} style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                        {claim.status || 'Pending'}
                      </span>
                    </td>
                    <td>{date}</td>
                    <td>
                      {claim.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className={styles.actionBtn}
                            style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            className={styles.actionBtn}
                            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                            onClick={() => handleUpdateStatus(claim.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.actionBtn}
                          onClick={() => { setSelectedClaim(claim); setIsDetailOpen(true); }}
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ClaimDetailModal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedClaim(null); }}
        claim={selectedClaim}
      />
    </div>
  );
}
