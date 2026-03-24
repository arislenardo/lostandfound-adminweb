'use client';

import { useEffect, useState } from 'react';
import styles from './modal.module.css';

export default function UserDetailModal({ isOpen, onClose, user, adminIds, onToggleAdmin }) {
  if (!isOpen || !user) return null;

  const isAdmin = adminIds.has(user.id);
  
  // Format dates if they are Firestore timestamps
  const formatDate = (val) => {
    if (!val) return 'N/A';
    if (val.toDate) return val.toDate().toLocaleString();
    if (val instanceof Date) return val.toLocaleString();
    return String(val);
  };

  // Prepare fields to display, excluding internal or redundant ones
  const DISPLAY_LABELS = {
    id: 'User ID (UID)',
    name: 'Full Name',
    email: 'Email Address',
    phoneNumber: 'Phone Number',
    role: 'Primary Role',
    createdAt: 'Joined On',
    lastLogin: 'Last Active',
    gender: 'Gender',
    address: 'Home Address',
    type: 'User Type'
  };

  // Logic to filter out certain keys and format display
  const userFields = Object.entries(user).filter(([key]) => key !== 'id');

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        
        <div className={styles.modalHeader}>
          <h2>Citizen Profile Details</h2>
          <span className={styles.itemId}>UID: {user.id}</span>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.detailsSection}>
            {userFields.map(([key, value]) => (
              <div key={key} className={styles.detailRow}>
                <span className={styles.label}>{DISPLAY_LABELS[key] || key}</span>
                <span className={styles.value}>
                  {typeof value === 'boolean' 
                    ? (value ? 'YES' : 'NO') 
                    : (key.toLowerCase().includes('date') || key.toLowerCase().includes('time') || key === 'createdAt' || key === 'lastLogin') 
                      ? formatDate(value) 
                      : String(value || 'N/A')
                  }
                </span>
              </div>
            ))}
            
            <div className={styles.detailRow}>
              <span className={styles.label}>System Privilege</span>
              <span className={styles.value} style={{ color: isAdmin ? 'var(--primary)' : 'inherit', fontWeight: isAdmin ? '700' : '500' }}>
                {isAdmin ? 'ADMINISTRATOR' : 'STANDARD USER'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
            <button 
              className={isAdmin ? 'btnSecondary' : 'btnPrimary'} 
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--primary)',
                background: isAdmin ? 'transparent' : 'var(--primary)',
                color: isAdmin ? 'var(--primary)' : 'white',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              onClick={() => {
                onToggleAdmin(user);
                onClose();
              }}
            >
              {isAdmin ? 'Revoke Admin Status' : 'Grant Admin Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
