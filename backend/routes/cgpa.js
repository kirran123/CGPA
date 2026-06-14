const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const CgpaRecord = require('../models/CgpaRecord');
const HistoryLog = require('../models/HistoryLog');
const { protect, authorize, hasPermission } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Calculate and save single CGPA
router.post('/calculate', protect, hasPermission('DEPT_FULL_ACCESS'), async (req, res) => {
  let { studentName, registerNo, semesters, department, regulation } = req.body;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Cannot compute for other departments' });
  }

  if (!semesters || !Array.isArray(semesters) || semesters.length === 0) {
    return res.status(400).json({ message: 'Semesters array is required' });
  }

  // Auto-generate studentName and registerNo if not provided
  if (!studentName || !studentName.trim()) {
    const count = await CgpaRecord.countDocuments({ department: activeDept });
    studentName = `Student${count + 1}`;
  }
  if (!registerNo || !registerNo.trim()) {
    registerNo = `AUTO-${activeDept}-${Date.now()}`;
  }

  try {
    let gpaSum = 0;
    let countedSems = 0;

    const formattedSemesters = semesters.map(s => {
      const gpa = parseFloat(s.gpa);
      if (gpa > 0) {
        gpaSum += gpa;
        countedSems++;
      }
      return {
        semester: parseInt(s.semester),
        gpa,
        credits: 0
      };
    });

    const cgpa = countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0;
    const totalCredits = 0;

    const record = await CgpaRecord.findOneAndUpdate(
      { registerNo, department: activeDept },
      {
        studentName,
        registerNo,
        department: activeDept,
        regulation: regulation || 'R2021',
        semesters: formattedSemesters,
        totalCredits,
        cgpa,
        calculatedBy: req.user._id
      },
      { upsert: true, new: true }
    );

    await HistoryLog.create({
      action: 'Calculate CGPA',
      details: `Calculated CGPA (${cgpa}) for student ${studentName} (${registerNo}) across ${formattedSemesters.length} semesters`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk calculate CGPA via Excel or PDF
router.post('/bulk-calculate', protect, hasPermission('DEPT_FULL_ACCESS'), upload.single('file'), async (req, res) => {
  const { department, regulation } = req.body;
  const activeDept = department || req.user.department;

  if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
    return res.status(403).json({ message: 'Forbidden: Unauthorized department access' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload an Excel or PDF file' });
  }

  try {
    let parsedStudents = [];
    const isPdf = req.file.originalname.toLowerCase().endsWith('.pdf') || req.file.mimetype === 'application/pdf';

    if (isPdf) {
      const { parseCgpaPdf } = require('../services/pdfParser');
      parsedStudents = await parseCgpaPdf(req.file.buffer);
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (rawData.length === 0) {
        return res.status(400).json({ message: 'Excel file is empty' });
      }

      for (let index = 0; index < rawData.length; index++) {
        const row = rawData[index];
        const registerNo = String(row.RegisterNo || row['Register No'] || '').trim();
        const studentName = String(row.StudentName || row['Student Name'] || '').trim();

        if (!registerNo || !studentName) {
          continue;
        }

        const semesters = [];
        for (let sem = 1; sem <= 8; sem++) {
          const keys = [`Sem${sem}_GPA`, `Sem ${sem} GPA`, `Sem_${sem}_GPA` ];
          let gpaVal = undefined;
          for (const k of keys) {
            if (row[k] !== undefined) {
              gpaVal = parseFloat(row[k]);
              break;
            }
          }
          if (gpaVal !== undefined && !isNaN(gpaVal) && gpaVal > 0) {
            semesters.push({
              semester: sem,
              gpa: gpaVal,
              credits: 0
            });
          }
        }

        if (semesters.length > 0) {
          parsedStudents.push({
            registerNo,
            studentName,
            semesters
          });
        }
      }
    }

    if (parsedStudents.length === 0) {
      return res.status(400).json({ message: 'No valid student records found in the uploaded file.' });
    }

    const results = [];
    const errors = [];

    for (let index = 0; index < parsedStudents.length; index++) {
      const student = parsedStudents[index];
      const { registerNo, studentName, semesters } = student;

      try {
        let gpaSum = 0;
        let countedSems = 0;
        semesters.forEach(s => {
          if (s.gpa > 0) {
            gpaSum += s.gpa;
            countedSems++;
          }
        });

        const cgpa = countedSems > 0 ? parseFloat((gpaSum / countedSems).toFixed(2)) : 0;
        const totalCredits = 0;

        const record = await CgpaRecord.findOneAndUpdate(
          { registerNo, department: activeDept },
          {
            studentName,
            registerNo,
            department: activeDept,
            regulation: regulation || 'R2021',
            semesters,
            totalCredits,
            cgpa,
            calculatedBy: req.user._id,
            isBulk: true
          },
          { upsert: true, new: true }
        );

        results.push(record);
      } catch (err) {
        errors.push(`Record ${index + 1} (${studentName || registerNo}): ${err.message}`);
      }
    }

    await HistoryLog.create({
      action: 'Bulk Calculate CGPA',
      details: `Bulk calculated CGPA for ${results.length} students from ${isPdf ? 'PDF' : 'Excel'} in department ${activeDept}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.json({
      message: `Successfully calculated ${results.length} CGPA records.`,
      recordsCount: results.length,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Retrieve CGPA Records
router.get('/records', protect, async (req, res) => {
  try {
    let department = req.query.department || req.user.department;

    // Non-super-admin must belong to the requested department
    if (req.user.role !== 'super_admin' && (!department || department !== req.user.department)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    const filter = {};
    // Super admin: department filter is optional (all depts if not specified)
    if (department) filter.department = department;

    // Dept admin and staff only see records they personally calculated
    if (req.user.role === 'dept_admin' || req.user.role === 'staff') {
      filter.calculatedBy = req.user._id;
    }

    const records = await CgpaRecord.find(filter)
      .populate('calculatedBy', 'name')
      .sort({ createdAt: -1, cgpa: -1, registerNo: 1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
