const pdf = require('pdf-parse');
const Subject = require('../models/Subject');

// Normalize whitespace and punctuation for more tolerant matching
const normalize = (s = '') => String(s).replace(/[\u00A0\s]+/g, ' ').trim();

// Build a flexible regex for a subject code like CS3401 allowing optional separators (CS 3401, CS-3401)
const buildCodePattern = (code) => {
  const cleaned = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = cleaned.match(/^([A-Z]+)(\d+)$/i);
  if (m) {
    const letters = m[1];
    const digits = m[2];
    // allow optional separators and whitespace between letters and digits
    return `${letters}[\s\-_]*${digits}`;
  }
  // fallback: match the cleaned code anywhere
  return cleaned;
};

/**
 * Parses a text-based PDF buffer and extracts student results.
 * Uses database subject codes for the department & semester to anchor grade lookups.
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} department - Department code (e.g. 'CSE')
 * @param {number} semester - Semester number
 * @returns {Promise<Array>} List of student records: { registerNo, studentName, subjects: [{ subjectCode, grade }] }
 */
const parseResultPdf = async (buffer, department, semester) => {
  // Fetch active subjects in this department and semester to use as anchors
  let dbSubjects = await Subject.find({ department, semester: parseInt(semester) });

  // Extract text from PDF
  const data = await pdf(buffer);
  const text = normalize(data.text || '');

  if (!text) {
    throw new Error('Uploaded PDF appears to be empty or not text-readable. Ensure the PDF is selectable text (not an image).');
  }

  // Split text by lines
  const lines = text.split('\n').map(l => normalize(l)).filter(l => l.length > 0);

  // If DB has no configured subjects, attempt to discover subject codes from PDF as a fallback
  if (dbSubjects.length === 0) {
    const discovered = new Set();
    const codeRegex = /\b[A-Z]{2,4}[\s\-_]*\d{3,4}\b/gi;
    let m;
    while ((m = codeRegex.exec(text)) !== null) {
      discovered.add(m[0].toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    if (discovered.size === 0) {
      throw new Error(`No syllabus subjects found in database for department ${department}, semester ${semester}, and could not auto-discover codes from PDF. Please configure the syllabus catalog first.`);
    }
    dbSubjects = Array.from(discovered).map(c => ({ code: c, name: `Discovered ${c}`, credits: 3, semester: parseInt(semester), department }));
  }

  const subjectCodes = dbSubjects.map(s => String(s.code).toUpperCase());

  const students = [];
  
  // Find all register numbers (typically 8 to 12 digits)
  const studentIndices = [];
  lines.forEach((line, idx) => {
    const match = line.match(/\b\d{8,12}\b/);
    if (match) {
      const regNo = match[0];
      let name = '';
      
      // Look in the same line
      let lineTextWithoutReg = line.replace(regNo, '').trim();
      lineTextWithoutReg = lineTextWithoutReg.replace(/[^a-zA-Z\s\.]/g, '').trim();
      if (lineTextWithoutReg.length > 3 && /^[A-Z]/.test(lineTextWithoutReg)) {
        name = lineTextWithoutReg;
      } else {
        // Look in the next line
        const nextLine = lines[idx + 1] || '';
        const cleanedNext = nextLine.replace(/[^a-zA-Z\s\.]/g, '').trim();
        if (cleanedNext.length > 3 && /^[A-Z]/.test(cleanedNext) && !cleanedNext.match(/\b\d{8,12}\b/)) {
          name = cleanedNext;
        }
      }

      if (!name) {
        name = `Student ${regNo}`;
      }

      studentIndices.push({
        regNo,
        name,
        lineIdx: idx
      });
    }
  });

  if (studentIndices.length === 0) {
    throw new Error("Could not find any student register numbers (8-12 digits) in the uploaded PDF. Please ensure the PDF is text-readable.");
  }

  // Extract subject grades for each student
  for (let i = 0; i < studentIndices.length; i++) {
    const current = studentIndices[i];
    const next = studentIndices[i + 1];
    const startLine = current.lineIdx;
    const endLine = next ? next.lineIdx : lines.length;

    // Join all text in this student's section
    const studentTextBlock = lines.slice(startLine, endLine).join(' ');

    const studentSubjects = [];

    // For each expected subject, try a few tolerant match strategies
    subjectCodes.forEach(code => {
      const pat = buildCodePattern(code);
      const gradeOptions = '(O|A\\+|A|B\\+|B|C|U|RA|AB|UA)';

      // 1) Code followed nearby by grade
      const regex1 = new RegExp(`\\b${pat}\\b[\s\S]{0,40}?\\b${gradeOptions}\\b`, 'i');
      const m1 = studentTextBlock.match(regex1);
      if (m1) {
        let grade = m1[1] ? m1[1].toUpperCase() : m1[m1.length-1].toUpperCase();
        if (grade === 'AB' || grade === 'UA') grade = 'U';
        studentSubjects.push({ subjectCode: code, grade });
        return;
      }

      // 2) Grade appears before code (some reports list grade then code)
      const regex2 = new RegExp(`\\b${gradeOptions}\\b[\s\S]{0,20}?\\b${pat}\\b`, 'i');
      const m2 = studentTextBlock.match(regex2);
      if (m2) {
        let grade = m2[1] ? m2[1].toUpperCase() : m2[m2.length-1].toUpperCase();
        if (grade === 'AB' || grade === 'UA') grade = 'U';
        studentSubjects.push({ subjectCode: code, grade });
        return;
      }

      // 3) Table-like rows: look for the code anywhere and then a grade token within the same student block
      const codeRegex = new RegExp(`\\b${pat}\\b`, 'i');
      if (studentTextBlock.match(codeRegex)) {
        const gradeRegex = new RegExp(`\\b${gradeOptions}\\b`, 'ig');
        const gm = gradeRegex.exec(studentTextBlock);
        if (gm) {
          let grade = gm[0].toUpperCase();
          if (grade === 'AB' || grade === 'UA') grade = 'U';
          studentSubjects.push({ subjectCode: code, grade });
          return;
        }
      }
    });

    if (studentSubjects.length > 0) {
      students.push({ registerNo: current.regNo, studentName: current.name, subjects: studentSubjects });
    }
  }

  return students;
};

/**
 * Parses a text-based PDF buffer and extracts CGPA semesters results.
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Array>} List of student records: { registerNo, studentName, semesters: [{ semester, gpa, credits }] }
 */
const parseCgpaPdf = async (buffer) => {
  const data = await pdf(buffer);
  const text = normalize(data.text || '');

  const lines = text.split('\n').map(l => normalize(l)).filter(l => l.length > 0);
  const students = [];

  const studentIndices = [];
  lines.forEach((line, idx) => {
    const match = line.match(/\b\d{8,12}\b/);
    if (match) {
      const regNo = match[0];
      let name = '';
      
      let lineTextWithoutReg = line.replace(regNo, '').trim();
      lineTextWithoutReg = lineTextWithoutReg.replace(/[^a-zA-Z\s\.]/g, '').trim();
      if (lineTextWithoutReg.length > 3 && /^[A-Z]/.test(lineTextWithoutReg)) {
        name = lineTextWithoutReg;
      } else {
        const nextLine = lines[idx + 1] || '';
        const cleanedNext = nextLine.replace(/[^a-zA-Z\s\.]/g, '').trim();
        if (cleanedNext.length > 3 && /^[A-Z]/.test(cleanedNext) && !cleanedNext.match(/\b\d{8,12}\b/)) {
          name = cleanedNext;
        }
      }

      if (!name) name = `Student ${regNo}`;

      studentIndices.push({ regNo, name, lineIdx: idx });
    }
  });

  if (studentIndices.length === 0) {
    throw new Error("Could not find any student register numbers (8-12 digits) in the uploaded PDF. Please ensure the PDF is text-readable.");
  }

  for (let i = 0; i < studentIndices.length; i++) {
    const current = studentIndices[i];
    const next = studentIndices[i + 1];
    const startLine = current.lineIdx;
    const endLine = next ? next.lineIdx : lines.length;

    const studentTextBlock = lines.slice(startLine, endLine).join(' ');
    const semesters = [];

    for (let sem = 1; sem <= 8; sem++) {
      const gpaRegex = new RegExp(`Sem(?:ester)?\\s*${sem}\\s*(?:GPA)?\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b`, 'i');
      const credRegex = new RegExp(`Sem(?:ester)?\\s*${sem}\\s*(?:Credits|Cred|C)?\\s*[:\\-\\s]?\\s*\\b(\\d+)\\b`, 'i');
      const combinedRegex = new RegExp(`Sem(?:ester)?\\s*${sem}\\s*[:\\-\\s]?\\s*\\b(\\d+(?:\\.\\d+)?)\\b\\s*(?:GPA)?\\s*\\b(\\d+)\\b`, 'i');
      
      let gpaVal = undefined;
      let credVal = undefined;

      const combinedMatch = studentTextBlock.match(combinedRegex);
      if (combinedMatch) {
        gpaVal = parseFloat(combinedMatch[1]);
        credVal = parseInt(combinedMatch[2]);
      } else {
        const gpaM = studentTextBlock.match(gpaRegex);
        const credM = studentTextBlock.match(credRegex);
        if (gpaM) gpaVal = parseFloat(gpaM[1]);
        if (credM) credVal = parseInt(credM[1]);
      }

      if (gpaVal !== undefined && credVal !== undefined && !isNaN(gpaVal) && !isNaN(credVal)) {
        semesters.push({
          semester: sem,
          gpa: gpaVal,
          credits: credVal
        });
      }
    }

    if (semesters.length > 0) {
      students.push({
        registerNo: current.regNo,
        studentName: current.name,
        semesters
      });
    }
  }

  return students;
};

module.exports = { parseResultPdf, parseCgpaPdf };
