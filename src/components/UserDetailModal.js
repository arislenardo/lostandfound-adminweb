'use client';

import { useEffect, useState } from 'react';
import styles from './modal.module.css';

/**
 * Modal component for displaying detailed information about a user/citizen.
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {Function} props.onClose - Callback to trigger when closing the modal.
 * @param {Object} props.user - The user object to display.
 * @param {Set<string>} props.adminIds - A set of user IDs that have administrative privileges.
 * @param {Function} props.onToggleAdmin - Optional callback to toggle administrative privileges.
 * @returns {JSX.Element|null} The rendered modal or null if closed.
 */
export default function UserDetailModal({ isOpen, onClose, user, adminIds, onToggleAdmin }) {
  if (!isOpen || !user) return null;

  const isAdmin = adminIds.has(user.id);
  
  /**
   * Formats a given date value into a human-readable string.
   * Handles Firestore Timestamps, standard Date objects, and falls back to string conversion.
   * @param {any} val - The date value to format.
   * @returns {string} The formatted date string or 'N/A' if null/undefined.
   */
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
        </div>
      </div>
    </div>
  );
}
