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
  
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Prepare table data
  const head = [columns.map(col => col.header)];
  const body = data.map(row => columns.map(col => {
    const val = row[col.key];
    if (val === null || val === undefined) return '';
    return String(val);
  }));
  
  autoTable(doc, {
    startY: 20,
    head: head,
    body: body,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
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
    return String(val);
  }));
  
  const wsData = [headers, ...rows];
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
