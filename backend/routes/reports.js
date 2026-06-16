const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const GpaRecord = require('../models/GpaRecord');
const CgpaRecord = require('../models/CgpaRecord');
const Subject = require('../models/Subject');
const { buildGpaPdf, buildCgpaPdf, buildRankListPdf, buildBatchGpaPdf } = require('../services/pdf.service');
const { protect } = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage() });

// Helper to calculate grade points from grade text
const gradePointsMap = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'U': 0, 'RA': 0
};

// 1. Public GPA PDF Download (No Login Required)
// Allow anonymous generation when studentName/registerNo are not provided — substitute placeholders.
router.post('/gpa-pdf', async (req, res) => {
  let { studentName, registerNo, semester, department, regulation, subjects } = req.body;

  if (!semester || !department || !subjects || !Array.isArray(subjects)) {
    return res.status(400).json({ message: 'Missing required fields for PDF generation' });
  }

  studentName = studentName || 'ANONYMOUS';
  registerNo = registerNo || `ANON-${Date.now()}`;

  try {
    // Only process subjects that have a real grade — skip blank/absent ones
    const validGrades = new Set(['O', 'A+', 'A', 'B+', 'B', 'C', 'U', 'RA']);
    let totalCredits = 0;
    let totalPoints = 0;
    const compiledSubjects = [];

    for (const s of subjects) {
      const rawGrade = String(s.grade || '').trim().toUpperCase();
      // Skip subjects with no grade or a placeholder non-grade value
      if (!rawGrade || rawGrade === '-' || rawGrade === 'N/A' || rawGrade === 'NA' ||
          rawGrade === 'AB' || rawGrade === 'ABSENT' || !validGrades.has(rawGrade)) continue;

      const credits = parseInt(s.credits || 0);
      const gradePoint = gradePointsMap[rawGrade] !== undefined ? gradePointsMap[rawGrade] : 0;
      totalCredits += credits;
      totalPoints += credits * gradePoint;
      compiledSubjects.push({
        subjectCode: s.subjectCode || 'N/A',
        subjectName: s.subjectName || 'N/A',
        credits,
        grade: rawGrade,
        gradePoint
      });
    }

    if (compiledSubjects.length === 0) {
      return res.status(400).json({ message: 'No subjects with valid grades found. Please enter at least one grade.' });
    }

    const gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;

    const pdfBuffer = await buildGpaPdf({
      studentName,
      registerNo,
      semester: parseInt(semester),
      department,
      regulation: regulation || 'R2021',
      subjects: compiledSubjects,
      totalCredits,
      totalPoints,
      gpa
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=GPA_Sem${semester}_${registerNo}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Public CGPA PDF Download (No Login Required)
// Allow anonymous generation when studentName/registerNo are not provided — substitute placeholders.
router.post('/cgpa-pdf', async (req, res) => {
  let { studentName, registerNo, department, regulation, semesters } = req.body;

  if (!department || !semesters || !Array.isArray(semesters)) {
    return res.status(400).json({ message: 'Missing required fields for PDF generation' });
  }

  studentName = studentName || 'ANONYMOUS';
  registerNo = registerNo || `ANON-${Date.now()}`;

  try {
    let totalCredits = 0;
    let totalWeightedPoints = 0;

    const compiledSemesters = semesters.map(s => {
      const gpa = parseFloat(s.gpa || 0);
      const credits = parseInt(s.credits || 0);
      totalCredits += credits;
      totalWeightedPoints += gpa * credits;
      return {
        semester: parseInt(s.semester),
        gpa,
        credits
      };
    });

    const cgpa = totalCredits > 0 ? parseFloat((totalWeightedPoints / totalCredits).toFixed(2)) : 0;

    const pdfBuffer = await buildCgpaPdf({
      studentName,
      registerNo,
      department,
      regulation: regulation || 'R2021',
      semesters: compiledSemesters,
      cgpa
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CGPA_${registerNo}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Stored GPA Report (Requires Login)
router.get('/gpa/:id', protect, async (req, res) => {
  try {
    const record = await GpaRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'GPA Record not found' });
    }

    if (req.user.role !== 'super_admin' && record.department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    let totalCredits = 0;
    let totalPoints = 0;
    record.subjects.forEach(s => {
      totalCredits += s.credits;
      totalPoints += s.credits * s.gradePoint;
    });

    const pdfBuffer = await buildGpaPdf({
      studentName: record.studentName,
      registerNo: record.registerNo,
      semester: record.semester,
      department: record.department,
      regulation: record.regulation || 'R2021',
      subjects: record.subjects,
      totalCredits,
      totalPoints,
      gpa: record.gpa
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=GPA_Sem${record.semester}_${record.registerNo}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Stored CGPA Report (Requires Login)
router.get('/cgpa/:id', protect, async (req, res) => {
  try {
    const record = await CgpaRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'CGPA Record not found' });
    }

    if (req.user.role !== 'super_admin' && record.department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const pdfBuffer = await buildCgpaPdf({
      studentName: record.studentName,
      registerNo: record.registerNo,
      department: record.department,
      regulation: record.regulation || 'R2021',
      semesters: record.semesters,
      cgpa: record.cgpa
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CGPA_${record.registerNo}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. GPA Rank List PDF Generation (Requires Login)
router.get('/rank-list/gpa', protect, async (req, res) => {
  const { semester, department } = req.query;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Access denied' });
  }

  if (!semester) {
    return res.status(400).json({ message: 'Semester is required' });
  }

  try {
    const records = await GpaRecord.find({ department: activeDept, semester: parseInt(semester) })
      .sort({ gpa: -1, registerNo: 1 })
      .limit(100);

    const pdfBuffer = await buildRankListPdf(records, {
      department: activeDept,
      semester: parseInt(semester),
      type: 'GPA'
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=RankList_GPA_Sem${semester}_${activeDept}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. CGPA Rank List PDF Generation (Requires Login)
router.get('/rank-list/cgpa', protect, async (req, res) => {
  const { department } = req.query;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Access denied' });
  }

  try {
    const records = await CgpaRecord.find({ department: activeDept })
      .sort({ cgpa: -1, registerNo: 1 })
      .limit(100);

    const pdfBuffer = await buildRankListPdf(records, {
      department: activeDept,
      type: 'CGPA'
    });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=RankList_CGPA_${activeDept}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7. Batch GPA PDF Download (Requires Login)
router.get('/batch/:batchId/pdf', protect, async (req, res) => {
  try {
    const records = await GpaRecord.find({ batchId: req.params.batchId }).sort({ registerNo: 1 });
    if (!records.length) {
      return res.status(404).json({ message: 'Batch not found or empty' });
    }
    // Dept access check: non-super-admin can only access their own department
    if (req.user.role !== 'super_admin' && records[0].department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }
    const batchName = records[0].batchName || req.params.batchId;
    const pdfBuffer = await buildBatchGpaPdf(records, { batchName });
    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Batch_${batchName.replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper for in-memory calculations without saving
// Skips subjects with no valid grade — they won't appear in the PDF or GPA calculation.
const VALID_GRADE_SET = new Set(['O', 'A+', 'A', 'B+', 'B', 'C', 'U', 'RA']);
const isValidGrade = (raw) => {
  if (!raw) return false;
  const g = String(raw).trim().toUpperCase();
  if (!g || g === '-' || g === 'N/A' || g === 'NA' || g === 'AB' ||
      g === 'ABSENT' || g === '0' || g === 'NULL') return false;
  return VALID_GRADE_SET.has(g);
};

const calculateGPA = async (registerNo, semester, subjectsInput, department, regulation) => {
  let currentGPA = 0;
  let totalCurrentCredits = 0;
  let totalCurrentPoints = 0;

  const subjectsDetails = [];
  for (const s of subjectsInput) {
    // Skip subjects with no valid grade — absent/empty cells are not counted
    if (!isValidGrade(s.grade)) continue;

    const query = { code: s.subjectCode.toUpperCase(), department };
    if (regulation) {
      query.regulation = { $regex: regulation, $options: 'i' };
    }
    const subject = await Subject.findOne(query);
    if (!subject) {
      throw new Error(`Subject with code ${s.subjectCode} not found in department ${department}${regulation ? ' (Regulation: ' + regulation + ')' : ''}`);
    }
    const normalGrade = s.grade.trim().toUpperCase();
    const gradePoint = gradePointsMap[normalGrade] !== undefined ? gradePointsMap[normalGrade] : 0;

    totalCurrentCredits += subject.credits;
    totalCurrentPoints += (subject.credits * gradePoint);

    subjectsDetails.push({
      subjectCode: subject.code,
      subjectName: subject.name,
      grade: normalGrade,
      gradePoint: gradePoint,
      credits: subject.credits
    });
  }

  currentGPA = totalCurrentCredits > 0 ? (totalCurrentPoints / totalCurrentCredits) : 0;

  return {
    gpa: parseFloat(currentGPA.toFixed(2)),
    subjects: subjectsDetails
  };
};

// 8. Bulk GPA PDF Generation (Stateless — calculate & download PDF directly, no DB persistence)
router.post('/bulk-gpa-pdf', protect, upload.single('file'), async (req, res) => {
  const { semester, department, regulation, batchName } = req.body;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Unauthorized department access' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel, CSV, or PDF file' });
  }

  const FROM_FILE = '__from_file__';
  const semFromFile = semester === FROM_FILE;
  const regFromFile = regulation === FROM_FILE;

  if (!semFromFile && (!semester || isNaN(parseInt(semester)))) {
    return res.status(400).json({ message: 'Please specify a valid semester (1-8) or choose "From file".' });
  }

  const resolvedBatchName = (batchName || '').trim() || 'Batch';

  try {
    let parsedStudents = [];
    const origName = req.file.originalname.toLowerCase();
    const isPdf = origName.endsWith('.pdf') || req.file.mimetype === 'application/pdf';
    const isCsv = origName.endsWith('.csv');

    if (isPdf) {
      const semNum = parseInt(semester);
      if (isNaN(semNum)) {
        return res.status(400).json({ message: 'Please select a specific semester when uploading a PDF.' });
      }
      const { parseResultPdf } = require('../services/pdfParser');
      parsedStudents = await parseResultPdf(req.file.buffer, activeDept, semNum);
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });

      if (rawData.length === 0) {
        return res.status(400).json({ message: 'File is empty or could not be parsed.' });
      }

      const pick = (row, ...keys) => {
        for (const k of keys) {
          const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
          if (found !== undefined && String(row[found]).trim() !== '') return String(row[found]).trim();
        }
        return '';
      };

      const sanitizeRegisterNo = (val) => {
        if (val === undefined || val === null) return '';
        let str = String(val).trim();
        if (/^[+-]?\d+(\.\d+)?[Ee][+-]?\d+$/.test(str)) {
          const num = Number(str);
          if (!isNaN(num)) {
            return Math.round(num).toString();
          }
        }
        return str;
      };

      for (let index = 0; index < rawData.length; index++) {
        const row = rawData[index];
        const rawRegisterNo = pick(row, 'RegisterNo', 'Register No', 'register_no', 'register no');
        const registerNo = sanitizeRegisterNo(rawRegisterNo);
        const studentName = pick(row, 'StudentName', 'Student Name', 'student_name', 'name');

        if (!registerNo) continue;

        let rowSemester;
        if (semFromFile) {
          const fileSem = pick(row, 'Semester', 'Sem', 'semester', 'sem');
          rowSemester = fileSem ? parseInt(fileSem) : null;
          if (!rowSemester || isNaN(rowSemester)) continue;
        } else {
          rowSemester = parseInt(semester);
        }

        let rowRegulation;
        if (regFromFile) {
          const fileReg = pick(row, 'Regulation', 'Reg', 'regulation', 'reg');
          rowRegulation = fileReg || null;
        } else {
          rowRegulation = regulation || null;
        }

        const metaKeys = ['registerno', 'register no', 'register_no', 'studentname', 'student name', 'student_name', 'name', 'semester', 'sem', 'regulation', 'reg'];
        const studentSubjects = [];
        Object.keys(row).forEach(key => {
          if (!metaKeys.includes(key.trim().toLowerCase())) {
            const rawGrade = String(row[key] ?? '').trim();
            // Only include subjects where a real grade was entered — skip empty/absent cells
            if (isValidGrade(rawGrade)) {
              studentSubjects.push({ subjectCode: key.trim(), grade: rawGrade });
            }
          }
        });

        if (studentSubjects.length > 0) {
          parsedStudents.push({
            registerNo,
            studentName: studentName || `Student_${registerNo}`,
            semester: rowSemester,
            regulation: rowRegulation,
            subjects: studentSubjects
          });
        }
      }
    }

    if (parsedStudents.length === 0) {
      return res.status(400).json({ message: 'No valid student records found.' });
    }

    const records = [];
    const errors = [];

    for (let index = 0; index < parsedStudents.length; index++) {
      const student = parsedStudents[index];
      const { registerNo, studentName, semester: rowSem, regulation: rowReg, subjects: studentSubjects } = student;

      try {
        const { gpa, subjects: subjectsDetails } = await calculateGPA(
          registerNo, rowSem, studentSubjects, activeDept, rowReg
        );

        records.push({
          studentName,
          registerNo,
          semester: rowSem,
          regulation: rowReg,
          department: activeDept,
          gpa,
          subjects: subjectsDetails
        });
      } catch (err) {
        errors.push(`Record ${index + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'All calculations failed. Errors:\n' + errors.join('\n') });
    }

    // Generate batch PDF buffer
    const pdfBuffer = await buildBatchGpaPdf(records, { batchName: resolvedBatchName });

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Batch_${resolvedBatchName.replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
