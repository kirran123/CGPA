const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const GpaRecord = require('../models/GpaRecord');
const Subject = require('../models/Subject');
const HistoryLog = require('../models/HistoryLog');
const GradeSetting = require('../models/GradeSetting');
const { protect, hasPermission } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Default fallback grade mapping
const DEFAULT_GRADE_MAP = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'U': 0, 'RA': 0
};

// Helper: fetch configured grade mapping from DB or use default fallback
const getGradePointsMap = async (regulation, semester) => {
  const semNum = parseInt(semester);
  if (!regulation || isNaN(semNum)) {
    return DEFAULT_GRADE_MAP;
  }
  try {
    const setting = await GradeSetting.findOne({
      regulation: { $regex: new RegExp(`^${regulation}$`, 'i') },
      semester: semNum
    });
    if (setting && setting.grades && setting.grades.length > 0) {
      const map = {};
      setting.grades.forEach(g => {
        map[g.grade.toUpperCase()] = g.points;
      });
      if (map['RA'] === undefined) map['RA'] = 0;
      return map;
    }
  } catch (error) {
    console.error('Error fetching grade settings:', error.message);
  }
  return DEFAULT_GRADE_MAP;
};

// Returns true if the raw grade string from Excel/input represents an actual grade entry
const isValidGrade = (raw, validGradesSet) => {
  if (!raw) return false;
  const g = String(raw).trim().toUpperCase();
  if (g === '' || g === '-' || g === 'N/A' || g === 'NA' || g === 'AB' ||
      g === 'ABSENT' || g === '0' || g === 'NULL' || g === 'UNDEFINED') return false;
  return (validGradesSet || new Set(['O', 'A+', 'A', 'B+', 'B', 'C', 'U', 'RA'])).has(g);
};

// Helper: Calculate GPA and overall CGPA
// Only subjects with a VALID grade are included — absent/empty subjects are silently skipped.
const calculateGPAAndCGPA = async (registerNo, semester, subjectsInput, department, regulation, gradePointsMap) => {
  let currentGPA = 0;
  let totalCurrentCredits = 0;
  let totalCurrentPoints = 0;

  const validGradesSet = new Set(Object.keys(gradePointsMap));

  // Compile subjects details — skip any subject without a valid grade
  const subjectsDetails = [];
  for (const s of subjectsInput) {
    // Skip subjects with no grade or an invalid/absent grade value
    if (!isValidGrade(s.grade, validGradesSet)) continue;

    const query = { code: s.subjectCode.toUpperCase(), department };
    if (regulation) {
      query.regulation = { $regex: regulation, $options: 'i' };
    }
    const subject = await Subject.findOne(query);
    if (!subject) {
      console.warn(`Subject with code ${s.subjectCode} not found in department ${department}, skipping.`);
      continue;
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
    cgpa: 0,
    subjects: subjectsDetails
  };
};

// Calculate and save single GPA/CGPA
router.post('/calculate', protect, hasPermission('DEPT_FULL_ACCESS'), async (req, res) => {
  let { studentName, registerNo, semester, subjects, department, regulation } = req.body;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Cannot compute for other departments' });
  }

  // Auto-generate studentName and registerNo if not provided
  if (!studentName || !studentName.trim()) {
    const count = await GpaRecord.countDocuments({ department: activeDept });
    studentName = `Student${count + 1}`;
  }
  if (!registerNo || !registerNo.trim()) {
    registerNo = `AUTO-${activeDept}-${Date.now()}`;
  }

  try {
    const gradeMap = await getGradePointsMap(regulation, semester);
    const { gpa, cgpa, subjects: subjectsDetails } = await calculateGPAAndCGPA(registerNo, semester, subjects, activeDept, regulation, gradeMap);

    // Update or create GPA record
    const record = await GpaRecord.findOneAndUpdate(
      { registerNo, semester, batchId: '' },
      {
        studentName,
        registerNo,
        semester: parseInt(semester),
        gpa,
        cgpa,
        subjects: subjectsDetails,
        department: activeDept,
        batchId: '',
        calculatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    await HistoryLog.create({
      action: 'Calculate GPA',
      details: `Calculated GPA (${gpa}) for student ${studentName} (${registerNo}), Sem ${semester}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.status(200).json(record);
  } catch (error) {
    if (error.message.includes('not found in department')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
});


// Bulk calculate via Excel or PDF upload
router.post('/bulk-calculate', protect, hasPermission('DEPT_FULL_ACCESS'), upload.single('file'), async (req, res) => {
  const { semester, department, regulation, batchName } = req.body;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Unauthorized department access' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel, CSV, or PDF file' });
  }

  // Sentinel: the frontend sends '__from_file__' when the user wants to read the value from the file
  const FROM_FILE = '__from_file__';
  const semFromFile = semester === FROM_FILE;
  const regFromFile = regulation === FROM_FILE;

  // If semester is not "from file", it must be a valid number
  if (!semFromFile && (!semester || isNaN(parseInt(semester)))) {
    return res.status(400).json({ message: 'Please specify a valid semester (1-8) or choose "From file".' });
  }

  // Build batch identifiers
  const resolvedBatchName = (batchName || '').trim() || `Batch ${new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}`;
  const batchId = `${activeDept}-${Date.now()}`;

  try {
    let parsedStudents = [];
    const origName = req.file.originalname.toLowerCase();
    const isPdf = origName.endsWith('.pdf') || req.file.mimetype === 'application/pdf';
    const isCsv = origName.endsWith('.csv');

    if (isPdf) {
      // PDF path — semester must be a real number for PDF (no per-row columns)
      const semNum = parseInt(semester);
      if (isNaN(semNum)) {
        return res.status(400).json({ message: 'Please select a specific semester when uploading a PDF (PDF does not support per-row semester/regulation).' });
      }
      const { parseResultPdf } = require('../services/pdfParser');
      parsedStudents = await parseResultPdf(req.file.buffer, activeDept, semNum);
    } else {
      // Excel (.xlsx/.xls) and CSV — xlsx library handles both natively
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });

      if (rawData.length === 0) {
        return res.status(400).json({ message: 'File is empty or could not be parsed. Ensure it has a header row.' });
      }

      // Case-insensitive pick helper: returns first matching key value
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
        // Handle scientific notation (e.g. 9.54E+11, 9.54e+11, 9.54e11)
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

        if (!registerNo) continue; // skip blank rows

        // Determine per-row semester
        let rowSemester;
        if (semFromFile) {
          const fileSem = pick(row, 'Semester', 'Sem', 'semester', 'sem');
          rowSemester = fileSem ? parseInt(fileSem) : null;
          if (!rowSemester || isNaN(rowSemester)) {
            continue; // no semester in file row and user chose "from file" — skip row
          }
        } else {
          rowSemester = parseInt(semester);
        }

        // Determine per-row regulation
        let rowRegulation;
        if (regFromFile) {
          const fileReg = pick(row, 'Regulation', 'Reg', 'regulation', 'reg');
          rowRegulation = fileReg || null; // null means "no regulation filter"
        } else {
          rowRegulation = regulation || null;
        }

        // Fetch custom grade map for this regulation and semester
        const gradeMap = await getGradePointsMap(rowRegulation, rowSemester);
        const validGradesSet = new Set(Object.keys(gradeMap));

        // Collect subject columns (skip meta columns)
        // Only include subjects where the student actually has a valid grade entered
        const metaKeys = [
          'registerno', 'register no', 'register_no',
          'studentname', 'student name', 'student_name', 'name',
          'semester', 'sem',
          'regulation', 'reg',
          'gpa', 'cgpa', 'total', 'result', 'remarks', 'rank', 's.no', 'sno', 'sl.no', 'slno', 'status'
        ];
        const studentSubjects = [];
        Object.keys(row).forEach(key => {
          const trimmedKey = key.trim();
          const keyLower = trimmedKey.toLowerCase();
          if (keyLower === '' || keyLower.startsWith('__empty')) return;

          if (!metaKeys.includes(keyLower)) {
            const rawGrade = String(row[key] ?? '').trim();
            // Skip empty cells and non-grade placeholders entirely
            if (isValidGrade(rawGrade, validGradesSet)) {
              studentSubjects.push({ subjectCode: trimmedKey, grade: rawGrade });
            }
          }
        });

        if (studentSubjects.length > 0) {
          parsedStudents.push({
            registerNo,
            studentName: studentName || `Student_${registerNo}`,
            semester: rowSemester,
            regulation: rowRegulation,
            subjects: studentSubjects,
            gradeMap
          });
        }
      }
    }

    if (parsedStudents.length === 0) {
      return res.status(400).json({ message: 'No valid student records found. Check that the file has RegisterNo and subject-code columns.' });
    }

    const results = [];
    const errors = [];

    for (let index = 0; index < parsedStudents.length; index++) {
      const student = parsedStudents[index];
      const { registerNo, studentName, semester: rowSem, regulation: rowReg, subjects: studentSubjects, gradeMap } = student;

      try {
        const { gpa, cgpa, subjects: subjectsDetails } = await calculateGPAAndCGPA(
          registerNo, rowSem, studentSubjects, activeDept, rowReg, gradeMap
        );

        const record = await GpaRecord.findOneAndUpdate(
          { registerNo, semester: rowSem, batchId },
          {
            studentName,
            registerNo,
            semester: rowSem,
            gpa,
            cgpa,
            subjects: subjectsDetails,
            department: activeDept,
            regulation: rowReg,
            isBulk: true,
            batchName: resolvedBatchName,
            batchId,
            calculatedBy: req.user._id
          },
          { upsert: true, new: true }
        );

        results.push(record);
      } catch (err) {
        errors.push(`Record ${index + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    await HistoryLog.create({
      action: 'Bulk Calculate GPA',
      details: `Bulk calculated GPA for ${results.length} students from ${isPdf ? 'PDF' : isCsv ? 'CSV' : 'Excel'} (sem: ${semFromFile ? 'from file' : semester}, reg: ${regFromFile ? 'from file' : regulation || 'any'})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.json({
      message: `Successfully calculated ${results.length} records.`,
      recordsCount: results.length,
      batchId,
      batchName: resolvedBatchName,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List all distinct batches (grouped by batchId)
router.get('/batches', protect, async (req, res) => {
  try {
    const { department } = req.query;
    const activeDept = department || (req.user.role !== 'super_admin' ? req.user.department : null);

    const matchStage = { batchId: { $exists: true, $ne: '' } };
    if (activeDept) matchStage.department = activeDept;
    if (req.user.role !== 'super_admin') matchStage.department = req.user.department;

    const batches = await GpaRecord.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$batchId',
          batchId: { $first: '$batchId' },
          batchName: { $first: '$batchName' },
          department: { $first: '$department' },
          semester: { $first: '$semester' },
          regulation: { $first: '$regulation' },
          count: { $sum: 1 },
          avgGpa: { $avg: '$gpa' },
          createdAt: { $first: '$createdAt' },
          calculatedBy: { $first: '$calculatedBy' }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all records in a specific batch
router.get('/batch/:batchId/records', protect, async (req, res) => {
  try {
    const records = await GpaRecord.find({ batchId: req.params.batchId })
      .sort({ registerNo: 1 })
      .populate('calculatedBy', 'name');

    if (records.length === 0) {
      return res.status(404).json({ message: 'Batch not found or empty' });
    }

    // Dept access check
    if (req.user.role !== 'super_admin' && records[0].department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Retrieve GPA/CGPA Records
router.get('/records', protect, async (req, res) => {
  try {
    let department = req.query.department || req.user.department;
    let semester = req.query.semester;

    // Non-super-admin must belong to the requested department
    if (req.user.role !== 'super_admin' && (!department || department !== req.user.department)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const filter = {};
    // Super admin: department filter is optional (all depts if not specified)
    if (department) filter.department = department;
    if (semester) filter.semester = parseInt(semester);

    // Dept admin and staff only see records they personally calculated
    if (req.user.role === 'dept_admin' || req.user.role === 'staff') {
      filter.calculatedBy = req.user._id;
    }

    const records = await GpaRecord.find(filter)
      .populate('calculatedBy', 'name')
      .sort({ createdAt: -1, semester: 1, registerNo: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a single GPA record
router.delete('/record/:id', protect, async (req, res) => {
  try {
    const record = await GpaRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Access check: non-super-admin can only delete records in their own department
    if (req.user.role !== 'super_admin' && record.department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    await GpaRecord.findByIdAndDelete(req.params.id);

    await HistoryLog.create({
      action: 'Delete GPA Record',
      details: `Deleted GPA record for student ${record.studentName} (${record.registerNo}), Sem ${record.semester}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: record.department
    });

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete an entire batch
router.delete('/batch/:batchId', protect, async (req, res) => {
  try {
    const records = await GpaRecord.find({ batchId: req.params.batchId });
    if (records.length === 0) {
      return res.status(404).json({ message: 'Batch not found or already deleted' });
    }

    // Access check: non-super-admin can only delete batches in their own department
    if (req.user.role !== 'super_admin' && records[0].department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const batchName = records[0].batchName || req.params.batchId;
    const department = records[0].department;

    await GpaRecord.deleteMany({ batchId: req.params.batchId });

    await HistoryLog.create({
      action: 'Delete GPA Batch',
      details: `Deleted entire GPA batch "${batchName}" (${records.length} records)`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: department
    });

    res.json({ message: 'Batch deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
