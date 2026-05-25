'use client';

import { useEffect, useState } from 'react';
import styles from './modal.module.css';

import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

/**
 * Modal component for displaying detailed information about a user/citizen.
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {Function} props.onClose - Callback to trigger when closing the modal.
 * @param {Object} props.user - The user object to display.
 * @param {Set<string>} props.adminIds - A set of user IDs that have administrative privileges.
 * @param {Function} props.onToggleAdmin - Optional callback to toggle administrative privileges.
 * @param {Function} props.onUpdate - Callback to update user locally.
 * @returns {JSX.Element|null} The rendered modal or null if closed.
 */
export default function UserDetailModal({ isOpen, onClose, user, adminIds, onToggleAdmin, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  // Reset edit state when user changes or modal closes/reopens
  useEffect(() => {
    setIsEditing(false);
    setFormData({});
  }, [user?.id, isOpen]);

  if (!isOpen || !user) return null;

  const isAdmin = adminIds.has(user.id);
  
  const handleStartEdit = () => {
    setFormData({
      name: user.name || '',
      phoneNumber: user.phoneNumber || '',
      address: user.address || '',
      role: user.role || 'Resident',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Duplicate Phone Check
      if (formData.phoneNumber && formData.phoneNumber !== user.phoneNumber) {
        const q = query(collection(db, 'users'), where('phoneNumber', '==', formData.phoneNumber));
        const snap = await getDocs(q);
        if (!snap.empty) {
          alert(`The phone number ${formData.phoneNumber} is already associated with another account.`);
          setSaving(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', user.id), formData);
      await addDoc(collection(db, 'admin_history'), {
        adminId: auth.currentUser?.uid || 'unknown',
        adminName: auth.currentUser?.email || 'Admin',
        actionType: 'EDITED_USER',
        itemTitle: formData.name || user.email || 'User',
        itemId: user.id,
        timestamp: serverTimestamp(),
      });
      if (onUpdate) {
        onUpdate(user.id, formData);
      }
      setIsEditing(false);
    } catch (error) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm("Are you sure you want to reactivate this account? You must verify the citizen's ID at the station first.")) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { status: 'active', lastLogin: serverTimestamp() });
      await addDoc(collection(db, 'admin_history'), {
        adminId: auth.currentUser?.uid || 'unknown',
        adminName: auth.currentUser?.email || 'Admin',
        actionType: 'EDITED_USER',
        itemTitle: `${user.name || user.email || 'User'} (Reactivated)`,
        itemId: user.id,
        timestamp: serverTimestamp(),
      });
      if (onUpdate) {
        onUpdate(user.id, { status: 'active' });
      }
      alert('Account successfully reactivated!');
    } catch (error) {
      alert(`Failed to reactivate: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm("Are you sure you want to deactivate this account manually?")) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { status: 'inactive' });
      await addDoc(collection(db, 'admin_history'), {
        adminId: auth.currentUser?.uid || 'unknown',
        adminName: auth.currentUser?.email || 'Admin',
        actionType: 'EDITED_USER',
        itemTitle: `${user.name || user.email || 'User'} (Deactivated)`,
        itemId: user.id,
        timestamp: serverTimestamp(),
      });
      if (onUpdate) {
        onUpdate(user.id, { status: 'inactive' });
      }
      alert('Account successfully deactivated!');
    } catch (error) {
      alert(`Failed to deactivate: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (val) => {
    if (!val) return 'N/A';
    if (val.toDate) return val.toDate().toLocaleString();
    if (val instanceof Date) return val.toLocaleString();
    return String(val);
  };

  const DISPLAY_LABELS = {
    id: 'User ID (UID)',
    name: 'Full Name',
    email: 'Email Address',
    phoneNumber: 'Phone Number',
    role: 'Primary Role',
    createdAt: 'Joined On',
    lastLogin: 'Last Active',
    address: 'Home Address',
    type: 'User Type'
  };

  const editableFields = ['name', 'phoneNumber', 'address', 'role'];

  const userFields = Object.entries(user).filter(([key]) => key !== 'id' && !editableFields.includes(key));

  const getInitials = (nameStr) => {
    if (!nameStr) return '?';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '850px' }}>
        <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        
        <div className={styles.modalHeader}>
          <h2>Citizen Profile Details</h2>
          <span className={styles.itemId}>UID: {user.id}</span>
        </div>

        <div className={styles.modalBody}>
          {/* Left Column: Profile Card */}
          <div className={styles.userAvatarContainer}>
            <div className={styles.userAvatar}>
              {getInitials(user.name || user.email)}
            </div>
            <h3 className={styles.userNameHeader}>{user.name || 'Citizen'}</h3>
            <p className={styles.userEmailHeader}>{user.email}</p>
            <span className={`${styles.userBadge} ${isAdmin ? styles.userBadgeAdmin : ''}`}>
              {isAdmin ? 'ADMINISTRATOR' : 'CITIZEN'}
            </span>
            {user.status === 'inactive' && (
              <span className={`${styles.userBadge}`} style={{ backgroundColor: '#dc2626', marginTop: '0.5rem' }}>
                INACTIVE
              </span>
            )}
          </div>

          {/* Right Column: User Information */}
          <div className={styles.detailsSection}>
            {/* Editable Fields */}
            {editableFields.map(key => (
              <div key={key} className={styles.detailRow}>
                <span className={styles.label}>{DISPLAY_LABELS[key] || key}</span>
                {isEditing ? (
                  key === 'role' ? (
                    <select
                      className={styles.formSelect}
                      value={formData[key]}
                      onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                    >
                      <option value="Resident">Resident</option>
                      <option value="Non-resident">Non-resident</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData[key]}
                      onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                    />
                  )
                ) : (
                  <span className={styles.value}>{user[key] || 'N/A'}</span>
                )}
              </div>
            ))}

            {/* Non-editable Fields */}
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

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              {user.status === 'inactive' ? (
                <button onClick={handleReactivate} disabled={saving} className={styles.saveBtn} style={{ backgroundColor: '#16a34a' }}>
                  {saving ? 'Processing...' : 'Verify ID & Reactivate Account'}
                </button>
              ) : isEditing ? (
                <>
                  <button onClick={handleSave} disabled={saving} className={styles.saveBtn}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={handleCancel} disabled={saving} className={styles.cancelBtn}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleStartEdit} className={styles.editBtn}>
                    Edit User Details
                  </button>
                  <button onClick={handleDeactivate} disabled={saving} className={styles.cancelBtn} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none' }}>
                    {saving ? 'Processing...' : 'Deactivate Account'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
