const ExcelJS = require('exceljs');

const GRADE_POINTS = { 'O':10,'A+':9,'A':8,'B+':7,'B':6,'C':5,'U':0,'RA':0 };

/**
 * Parse bulk GPA Excel file
 * Expected columns: RegisterNo, StudentName, [SubjectCode1], [SubjectCode2], ...
 */
const parseGpaExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No worksheet found in Excel file');

  const headers = [];
  sheet.getRow(1).eachCell(cell => headers.push(String(cell.value || '').trim()));

  if (!headers.includes('RegisterNo') && !headers.includes('Register No')) {
    throw new Error('Missing required column: RegisterNo');
  }

  const rows = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj = {};
    row.eachCell((cell, colNum) => {
      const key = headers[colNum - 1];
      obj[key] = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
    });
    if (obj['RegisterNo'] || obj['Register No']) rows.push(obj);
  });

  return { headers, rows };
};

/**
 * Parse bulk CGPA Excel file
 * Expected columns: RegisterNo, StudentName, Sem1_GPA, Sem1_Credits, Sem2_GPA, Sem2_Credits, ...
 */
const parseCgpaExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const headers = [];
  sheet.getRow(1).eachCell(cell => headers.push(String(cell.value || '').trim()));

  const rows = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj = {};
    row.eachCell((cell, colNum) => {
      obj[headers[colNum - 1]] = cell.value !== null ? String(cell.value).trim() : '';
    });
    if (obj['RegisterNo'] || obj['Register No']) rows.push(obj);
  });
  return { headers, rows };
};

/**
 * Export results to Excel buffer
 */
const buildResultExcel = async (records, type = 'GPA') => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${type} Results`);

  if (type === 'GPA') {
    sheet.columns = [
      { header: 'Rank',        key: 'rank',        width: 8  },
      { header: 'Register No', key: 'registerNo',  width: 18 },
      { header: 'Name',        key: 'studentName', width: 28 },
      { header: 'Semester',    key: 'semester',    width: 12 },
      { header: 'GPA',         key: 'gpa',         width: 10 },
      { header: 'CGPA',        key: 'cgpa',         width: 10 },
      { header: 'Department',  key: 'department',  width: 14 },
    ];
  } else {
    sheet.columns = [
      { header: 'Rank',        key: 'rank',        width: 8  },
      { header: 'Register No', key: 'registerNo',  width: 18 },
      { header: 'Name',        key: 'studentName', width: 28 },
      { header: 'CGPA',        key: 'cgpa',        width: 10 },
      { header: 'Department',  key: 'department',  width: 14 },
    ];
  }

  // Style header row
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e1b4b' } };

  records.forEach((r, idx) => {
    sheet.addRow({ rank: idx + 1, ...r });
    if (idx < 3) {
      sheet.getRow(idx + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    }
  });

  return workbook.xlsx.writeBuffer();
};

module.exports = { parseGpaExcel, parseCgpaExcel, buildResultExcel, GRADE_POINTS };
