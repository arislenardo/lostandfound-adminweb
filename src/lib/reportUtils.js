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
export const exportToPDF = (title, columns, data, filename, dateRange = null) => {
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
  
  let headerBottom = 29;
  if (dateRange) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128); // Muted gray to match "Generated on"
    doc.text(`Report Period: ${dateRange}`, 14, 30);
    headerBottom = 34;
  }

  // Decorative line
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(14, headerBottom, pageWidth - 14, headerBottom);
  
  // --- TABLE SECTION ---
  const head = [columns.map(col => col.header)];
  const body = data.map(row => columns.map(col => {
    const val = row[col.key];
    return val !== null && val !== undefined ? String(val) : '';
  }));
  
  autoTable(doc, {
    startY: headerBottom + 5,
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
    margin: { top: headerBottom + 5, bottom: 20 },
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
 * @param {string} title - The title of the report.
 * @param {Array<{header: string, key: string}>} columns - Array of column definitions.
 * @param {Array<Object>} data - Array of data objects. Keys should match column keys.
 * @param {string} filename - The name of the file to save (without extension).
 * @param {string} dateRange - Optional string representing the filter period.
 */
export const exportToExcel = (title, columns, data, filename, dateRange = null) => {
  const headers = columns.map(col => col.header);
  
  const rows = data.map(row => columns.map(col => {
    const val = row[col.key];
    if (val === null || val === undefined) return '';
    if (col.key.toLowerCase() === 'status') return String(val).toUpperCase();
    return String(val);
  }));
  
  // Prepare worksheet data with metadata at the top
  const dateStr = new Date().toLocaleString('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  });
  const metadata = [
    [title.toUpperCase()],
    [`Generated on: ${dateStr}`],
  ];
  
  if (dateRange) {
    metadata.push([`Report Period: ${dateRange}`]);
  }
  
  // Add an empty row for spacing before the table
  const wsData = [...metadata, [], headers, ...rows];
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns: find the max length of content in each column
  // Note: We skip metadata rows for width calculation to avoid overly wide first columns
  const colWidths = headers.map((header, i) => {
    const maxContentLen = rows.reduce((max, row) => {
      const cellLen = row[i] ? String(row[i]).length : 0;
      return Math.max(max, cellLen);
    }, header.length);
    return { wch: maxContentLen + 3 };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Exports a consolidated report (multiple sections) to a single PDF.
 * 
 * @param {string} title - Main title
 * @param {Array<{title: string, columns: Array, data: Array}>} sections - Array of sections to include
 * @param {string} filename - Output filename
 * @param {string} dateRange - Optional date range string
 */
export const exportConsolidatedPDF = (title, sections, filename, dateRange = null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(22, 163, 74);
  doc.text(title, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  const dateStr = new Date().toLocaleString();
  doc.text(`Generated: ${dateStr}`, 14, 28);
  
  if (dateRange) {
    doc.text(`Period: ${dateRange}`, 14, 34);
  }
  
  let currentY = dateRange ? 40 : 34;
  
  sections.forEach((section, index) => {
    // Section Title
    if (currentY + 20 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, 14, currentY + 10);
    doc.setFont('helvetica', 'normal');
    
    const head = [section.columns.map(col => col.header)];
    const body = section.data.map(row => section.columns.map(col => {
      const val = row[col.key];
      return val !== null && val !== undefined ? String(val) : '';
    }));
    
    autoTable(doc, {
      startY: currentY + 15,
      head: head,
      body: body,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, 14, pageHeight - 10);
        doc.text("Lost and Found Admin - Consolidated Report", pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 10;
  });
  
  doc.save(`${filename}.pdf`);
};

/**
 * Exports multiple sections to an Excel workbook with multiple sheets.
 * 
 * @param {string} title - Main title (used in metadata)
 * @param {Array<{title: string, columns: Array, data: Array}>} sections - Array of sections
 * @param {string} filename - Output filename
 * @param {string} dateRange - Optional date range string
 */
export const exportConsolidatedExcel = (title, sections, filename, dateRange = null) => {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toLocaleString();
  
  // Prepare a single data array for one master sheet
  let wsData = [
    [title.toUpperCase()],
    [`Generated: ${dateStr}`],
  ];
  if (dateRange) wsData.push([`Period: ${dateRange}`]);
  wsData.push([]); // Spacer

  sections.forEach((section, index) => {
    // Add Section Header
    wsData.push([section.title.toUpperCase()]);
    
    // Add Table Headers
    const headers = section.columns.map(col => col.header);
    wsData.push(headers);

    // Add Data Rows
    const rows = section.data.map(row => section.columns.map(col => {
      const val = row[col.key];
      return val !== null && val !== undefined ? String(val) : '';
    }));
    wsData.push(...rows);

    // Add Spacer after section (except last)
    if (index < sections.length - 1) {
      wsData.push([], []); 
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-size columns based on the widest table (Found Items usually)
  // We'll calculate widths for the longest headers/rows across all sections
  const maxCols = Math.max(...wsData.map(r => r.length));
  const colWidths = Array(maxCols).fill(0).map((_, i) => {
    let maxLen = 10; // default
    wsData.forEach(row => {
      if (row[i]) {
        const len = String(row[i]).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(maxLen + 2, 50) }; // Cap at 50 for sanity
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Consolidated Report');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
