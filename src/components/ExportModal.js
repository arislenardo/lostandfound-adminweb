import React, { useState } from 'react';

/**
 * Modal component for exporting reports with a date range filter.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} props.onExport - Callback when export is triggered: (startDate, endDate, format) => void
 * @param {string} props.title - The title of the modal (e.g., "Export Found Items")
 */
export default function ExportModal({ isOpen, onClose, onExport, title }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (!isOpen) return null;

  const handleExport = (format) => {
    onExport(startDate, endDate, format);
    onClose();
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, backdropFilter: 'blur(8px)',
  };

  const contentStyle = {
    backgroundColor: 'var(--surface, #ffffff)', borderRadius: '12px',
    width: '90%', maxWidth: '400px', padding: '2rem',
    position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
    border: '1px solid var(--border, #e5e7eb)',
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem', borderRadius: '8px',
    border: '1px solid var(--border, #e5e7eb)', marginTop: '0.5rem',
    marginBottom: '1rem', boxSizing: 'border-box'
  };

  const btnStyle = {
    padding: '0.75rem 1rem', borderRadius: '8px', border: 'none',
    fontWeight: '600', cursor: 'pointer', flex: 1, color: 'white'
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={contentStyle} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1.25rem', fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
        >×</button>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground, #111827)' }}>
          {title}
        </h2>

        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground, #374151)' }}>Start Date (Optional)</label>
          <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>

        <div>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground, #374151)' }}>End Date (Optional)</label>
          <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button style={{ ...btnStyle, backgroundColor: '#dc2626' }} onClick={() => handleExport('pdf')}>
            Export PDF
          </button>
          <button style={{ ...btnStyle, backgroundColor: '#16a34a' }} onClick={() => handleExport('excel')}>
            Export Excel
          </button>
        </div>
      </div>
    </div>
  );
}
