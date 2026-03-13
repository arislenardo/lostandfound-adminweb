import styles from './modal.module.css';
import Image from 'next/image';

export default function ItemDetailModal({ isOpen, onClose, item, type }) {
  if (!isOpen || !item) return null;

  const date = item.createdAt ? new Date(item.createdAt.toDate()).toLocaleString() : 'Date Unknown';

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
              <span className={styles.value}>{item.name}</span>
            </div>
            
            <div className={styles.detailRow}>
              <span className={styles.label}>Category</span>
              <span className={styles.value} style={{ textTransform: 'capitalize' }}>{item.category || 'Other'}</span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Description</span>
              <span className={styles.value}>{item.description || 'No description provided.'}</span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Location</span>
              <span className={styles.value}>
                {item.locationName || `Lat: ${item.latitude}, Lng: ${item.longitude}` || 'Not specified'}
              </span>
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
              <span className={styles.value} style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                {item.status || 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
