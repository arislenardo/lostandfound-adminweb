import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * Exports tabular data to a PDF file.
 * 
 * @param {string} title - The title printed at the top of the PDF.
 * @param {Array<{header: string, key: string}>} columns - Array of column definitions.
 * @param {Array<Object>} data - Array of data objects. Keys should match column keys.
 * @param {string} filename - The name of the file to save (without extension).
 */
export const exportToPDF = (title, columns, data, filename) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // --- HEADER SECTION ---
  // Title
  doc.setFontSize(20);
  doc.setTextColor(22, 163, 74); // Green color
  doc.text(title, 14, 18);
  
  // Date and Metadata
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // Gray color
  const dateStr = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  });
  doc.text(`Generated on: ${dateStr}`, 14, 25);
  doc.text(`Total Records: ${data.length}`, pageWidth - 14, 25, { align: 'right' });
  
  // Decorative line
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(14, 29, pageWidth - 14, 29);
  
  // --- TABLE SECTION ---
  const head = [columns.map(col => col.header)];
  const body = data.map(row => columns.map(col => {
    const val = row[col.key];
    return val !== null && val !== undefined ? String(val) : '';
  }));
  
  autoTable(doc, {
    startY: 34,
    head: head,
    body: body,
    theme: 'striped',
    styles: { 
      fontSize: 8.5, 
      cellPadding: 2,
      valign: 'middle',
      font: 'helvetica'
    },
    headStyles: { 
      fillColor: [22, 163, 74], 
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { top: 34, bottom: 20 },
    didDrawPage: (d) => {
      // --- FOOTER SECTION ---
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      
      const footerY = pageHeight - 8;
      doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, 14, footerY);
      doc.text("Lost and Found Admin System Report", pageWidth / 2, footerY, { align: 'center' });
      doc.text("Official Report", pageWidth - 14, footerY, { align: 'right' });
    }
  });
  
  doc.save(`${filename}.pdf`);
};

/**
 * Exports tabular data to an Excel (.xlsx) file.
 * 
 * @param {string} title - (Unused in Excel currently, but kept for signature consistency)
 * @param {Array<{header: string, key: string}>} columns - Array of column definitions.
 * @param {Array<Object>} data - Array of data objects. Keys should match column keys.
 * @param {string} filename - The name of the file to save (without extension).
 */
export const exportToExcel = (title, columns, data, filename) => {
  const headers = columns.map(col => col.header);
  
  const rows = data.map(row => columns.map(col => {
    const val = row[col.key];
    if (val === null || val === undefined) return '';
    if (col.key.toLowerCase() === 'status') return String(val).toUpperCase();
    return String(val);
  }));
  
  const wsData = [headers, ...rows];
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns: find the max length of content in each column
  const colWidths = headers.map((header, i) => {
    const maxContentLen = rows.reduce((max, row) => {
      const cellLen = row[i] ? String(row[i]).length : 0;
      return Math.max(max, cellLen);
    }, header.length);
    return { wch: maxContentLen + 3 }; // Add a little extra padding
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
