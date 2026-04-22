'use client';

import { useState } from 'react';
import styles from './modal.module.css';
import Image from 'next/image';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const CATEGORIES = [
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
  'found': 'FOUND',
  'lost': 'LOST',
  'pending': 'PENDING',
  'claim_pending': 'CLAIM PENDING',
  'resolved': 'RESOLVED',
  'returned': 'RETURNED',
  'added': 'ADDED'
};

/**
 * Capitalizes the first letter of a given string.
 * @param {string} str - The string to capitalize.
 * @returns {string} The capitalized string.
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Safely converts a Firestore Timestamp or date string to a JavaScript Date object.
 * @param {any} value - The date value to convert.
 * @returns {Date|null} The converted Date object or null if invalid.
 */
function toDateSafe(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

/**
 * Formats the location data of an item for display.
 * Falls back to coordinates if a location name is not available.
 * @param {Object} item - The item containing location data.
 * @returns {string} The formatted location string.
 */
function getLocationDisplay(item) {
  if (item.locationName) return item.locationName;
  if (item.latitude != null && item.longitude != null) return `Lat: ${item.latitude}, Lng: ${item.longitude}`;
  return 'Not specified';
}

/**
 * Modal component for viewing and editing details of a lost or found item.
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {Function} props.onClose - Callback to trigger when closing the modal.
 * @param {Object} props.item - The item object to display or edit.
 * @param {string} props.type - The registry type ('lost' or 'found').
 * @param {Function} props.onUpdate - Callback to update the parent component's state after a successful edit.
 * @returns {JSX.Element|null} The rendered modal or null if closed.
 */
export default function ItemDetailModal({ isOpen, onClose, item, type, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  if (!isOpen || !item) return null;

  const dateObj = toDateSafe(item.createdAt);
  const date = dateObj ? dateObj.toLocaleString() : 'Date Unknown';

  const foundStatuses = ['found', 'returned'];
  const lostStatuses = ['lost', 'resolved', 'returned'];
  const statusOptions = type === 'found' ? foundStatuses : lostStatuses;
  const collectionName = type === 'found' ? 'found_items' : 'lost_items';

  /**
   * Enters edit mode and populates the form with the current item data.
   */
  const handleStartEdit = () => {
    setFormData({
      name: item.name || '',
      category: item.category || 'other',
      description: item.description || '',
      locationName: item.locationName || '',
      status: item.status || statusOptions[0],
    });
    setIsEditing(true);
  };

  /**
   * Exits edit mode and discards any unsaved changes.
   */
  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  /**
   * Validates and saves the edited item data to Firestore, creating an admin history log.
   */
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      alert('Item name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const adminUser = auth.currentUser;
      await updateDoc(doc(db, collectionName, item.id), {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        locationName: formData.locationName.trim(),
        status: formData.status,
      });
      await addDoc(collection(db, 'admin_history'), {
        adminId: adminUser?.uid || 'unknown',
        adminName: adminUser?.email || 'Admin',
        actionType: type === 'found' ? 'EDITED_FOUND_ITEM' : 'EDITED_LOST_ITEM',
        itemTitle: formData.name.trim(),
        itemId: item.id,
        timestamp: serverTimestamp(),
      });
      if (onUpdate) {
        onUpdate(item.id, {
          name: formData.name.trim(),
          category: formData.category,
          description: formData.description.trim(),
          locationName: formData.locationName.trim(),
          status: formData.status,
        });
      }
      setIsEditing(false);
      setFormData({});
    } catch (error) {
      console.error('Error updating item:', error);
      alert(`Failed to save changes: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
        
        <div className={styles.modalHeader}>
          <h2>{type === 'found' ? 'Found Item Details' : 'Lost Item Details'}</h2>
          <span className={styles.itemId}>ID: {item.id}</span>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.imageSection}>
            {item.imageUrl ? (
              <div className={styles.imageWrapper}>
                 <Image 
                    src={item.imageUrl} 
                    alt={item.name} 
                    fill
                    style={{ objectFit: 'cover', borderRadius: '8px' }}
                    unoptimized
                 />
              </div>
            ) : (
              <div className={styles.placeholderImage}>No Image Provided</div>
            )}
          </div>

          <div className={styles.detailsSection}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Name</span>
              {isEditing ? (
                <input
                  style={inputStyle}
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                />
              ) : (
                <span className={styles.value}>{item.name}</span>
              )}
            </div>
            
            <div className={styles.detailRow}>
              <span className={styles.label}>Category</span>
              {isEditing ? (
                <select
                  style={inputStyle}
                  value={formData.category}
                  onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{capitalize(c)}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.value} style={{ textTransform: 'capitalize' }}>{item.category || 'Other'}</span>
              )}
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Description</span>
              {isEditing ? (
                <textarea
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                />
              ) : (
                <span className={styles.value}>{item.description || 'No description provided.'}</span>
              )}
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Location</span>
              {isEditing ? (
                <input
                  style={inputStyle}
                  value={formData.locationName}
                  onChange={e => setFormData(f => ({ ...f, locationName: e.target.value }))}
                  placeholder="Location name"
                />
              ) : (
                <div className={styles.value}>
                  {item.latitude != null && item.longitude != null ? (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.mapLink}
                    >
                      📍 {item.locationName || `Lat: ${item.latitude}, Lng: ${item.longitude}`}
                      <span className={styles.externalHint}>(Open Maps)</span>
                    </a>
                  ) : item.locationName ? (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.locationName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.mapLink}
                    >
                      📍 {item.locationName}
                      <span className={styles.externalHint}>(Search Maps)</span>
                    </a>
                  ) : (
                    'Not specified'
                  )}
                </div>
              )}
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Date Reported</span>
              <span className={styles.value}>{date}</span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Reporter UID</span>
              <span className={styles.value} style={{ fontFamily: 'monospace' }}>{item.userId}</span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Status</span>
              {isEditing ? (
                <select
                  style={inputStyle}
                  value={formData.status}
                  onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s.toLowerCase()] || s.toUpperCase()}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.value} style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                  {STATUS_LABELS[(item.status || 'active').toLowerCase()] || item.status || 'ACTIVE'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={styles.saveBtn}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className={styles.cancelBtn}
                    style={{
                      padding: '0.5rem 1.25rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className={styles.editBtn}
                >
                  Edit Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
