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

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toDateSafe(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function getLocationDisplay(item) {
  if (item.locationName) return item.locationName;
  if (item.latitude != null && item.longitude != null) return `Lat: ${item.latitude}, Lng: ${item.longitude}`;
  return 'Not specified';
}

export default function ItemDetailModal({ isOpen, onClose, item, type, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  if (!isOpen || !item) return null;

  const dateObj = toDateSafe(item.createdAt);
  const date = dateObj ? dateObj.toLocaleString() : 'Date Unknown';

  const foundStatuses = ['found', 'returned'];
  const lostStatuses = ['lost', 'resolved'];
  const statusOptions = type === 'found' ? foundStatuses : lostStatuses;
  const collectionName = type === 'found' ? 'found_items' : 'lost_items';

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

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

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
                    <option key={s} value={s}>{capitalize(s)}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.value} style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                  {item.status || 'Active'}
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
