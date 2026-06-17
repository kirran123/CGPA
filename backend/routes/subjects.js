const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const HistoryLog = require('../models/HistoryLog');
const { protect, hasPermission } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');

// Multer: in-memory storage so we can process the buffer directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv|pdf)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Only Excel (.xlsx/.xls/.csv) or PDF files are allowed'));
    cb(null, true);
  }
});

/**
 * Parse Excel / CSV buffer → array of { code, name, credits, semester, regulation }
 * Expected columns (case-insensitive, any order):
 *   Code, Subject Code, Name, Subject Name, Credits, Semester, Regulation
 */
function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return rows
    .map(r => {
      // Normalise keys to lower-case without spaces
      const norm = {};
      for (const k of Object.keys(r)) norm[k.toLowerCase().replace(/\s+/g, '')] = r[k];

      const code       = String(norm['code'] || norm['subjectcode'] || '').trim().toUpperCase();
      const name       = String(norm['name'] || norm['subjectname'] || '').trim();
      const credits    = parseInt(norm['credits'] || norm['credit'] || 0, 10);
      const semester   = parseInt(norm['semester'] || norm['sem'] || 0, 10);
      const regulation = String(norm['regulation'] || norm['reg'] || '').trim();

      return { code, name, credits, semester, regulation };
    })
    .filter(s => s.code && s.name && s.semester > 0);
}

/**
 * Parse PDF text → array of subject objects.
 * Tries to detect lines that look like:
 *   [Code]  [Name]  [Credits]  [Semester]  [Regulation?]
 * or tables with those columns.
 */
function parsePdf(text) {
  const subjects = [];

  // Split into lines and clean
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Heuristic: find header row so we know column order
  let headerIdx = -1;
  let colOrder = null;

  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if ((low.includes('code') || low.includes('subject')) && low.includes('name') && (low.includes('credit') || low.includes('sem'))) {
      headerIdx = i;
      // Detect column positions by keywords
      colOrder = [];
      if (low.indexOf('code') < low.indexOf('name')) colOrder.push('code', 'name');
      else colOrder.push('name', 'code');
      if (low.includes('credit')) colOrder.push('credits');
      if (low.includes('sem')) colOrder.push('semester');
      if (low.includes('reg')) colOrder.push('regulation');
      break;
    }
  }

  // If header found, parse subsequent lines as data rows
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      // Simple positional mapping
      let code = '', name = '', credits = 3, semester = 0, regulation = '';
      if (colOrder) {
        colOrder.forEach((col, ci) => {
          if (!parts[ci]) return;
          if (col === 'code') code = parts[ci].toUpperCase();
          else if (col === 'name') name = parts[ci];
          else if (col === 'credits') credits = (parts[ci] !== undefined && parts[ci] !== '') ? parseInt(parts[ci], 10) : 3;
          else if (col === 'semester') semester = parseInt(parts[ci], 10) || 0;
          else if (col === 'regulation') regulation = parts[ci];
        });
      }
      if (code && name && semester > 0) subjects.push({ code, name, credits, semester, regulation });
    }
  }

  // Fallback: pattern match lines like  CS3401  Database Systems  3  4
  if (subjects.length === 0) {
    // Regex: starts with alphanumeric code (≥4 chars), then name, then digits
    const re = /^([A-Z0-9]{3,10})\s{2,}(.+?)\s{2,}(\d+)\s{2,}(\d)\s*(.*)$/i;
    for (const line of lines) {
      const m = line.match(re);
      if (m) {
        subjects.push({
          code: m[1].trim().toUpperCase(),
          name: m[2].trim(),
          credits: (m[3] !== undefined && m[3] !== '') ? parseInt(m[3], 10) : 3,
          semester: parseInt(m[4], 10) || 0,
          regulation: (m[5] || '').trim()
        });
      }
    }
  }

  return subjects.filter(s => s.code && s.name && s.semester > 0);
}

// ── Bulk Upload ──────────────────────────────────────────────────────────────
router.post('/bulk-upload', protect, hasPermission('EDIT_SUBJECT_CATALOGUE'), upload.single('file'), async (req, res) => {
  try {
    const { department, regulation, semester, skipDuplicates } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const activeDept = department || req.user.department;
    if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Cannot write to other departments' });
    }

    // Parse file
    let parsed = [];
    const ext = file.originalname.toLowerCase();

    if (ext.endsWith('.pdf')) {
      const data = await pdfParse(file.buffer);
      parsed = parsePdf(data.text);
    } else {
      parsed = parseExcel(file.buffer);
    }

    if (parsed.length === 0) {
      return res.status(400).json({
        message: 'Could not extract any subjects from the file. Please check the format.',
        hint: 'Excel: columns Code, Name, Credits, Semester, Regulation | PDF: tabular layout'
      });
    }

    // Apply override values from form if provided
    const overrideReg = regulation ? regulation.trim() : null;
    const overrideSem = semester ? parseInt(semester, 10) : null;

    const results = { added: [], skipped: [], errors: [] };

    for (const row of parsed) {
      const finalReg = overrideReg || row.regulation || 'R2021';
      const finalSem = overrideSem || row.semester;
      const finalCode = row.code.toUpperCase();

      if (!finalSem || finalSem < 1 || finalSem > 8) {
        results.errors.push({ code: finalCode, reason: `Invalid semester: ${finalSem}` });
        continue;
      }

      try {
        const existing = await Subject.findOne({ code: finalCode, department: activeDept, regulation: finalReg });
        if (existing) {
          if (skipDuplicates === 'true' || skipDuplicates === true) {
            results.skipped.push(finalCode);
            continue;
          }
          // Update existing
          existing.name = row.name;
          existing.credits = (row.credits !== undefined && row.credits !== '') ? Number(row.credits) : existing.credits;
          existing.semester = finalSem;
          existing.regulation = finalReg;
          await existing.save();
          results.added.push(finalCode + ' (updated)');
        } else {
          await Subject.create({
            code: finalCode,
            name: row.name,
            credits: (row.credits !== undefined && row.credits !== '') ? Number(row.credits) : 3,
            semester: finalSem,
            department: activeDept,
            regulation: finalReg
          });
          results.added.push(finalCode);
        }
      } catch (err) {
        results.errors.push({ code: finalCode, reason: err.message });
      }
    }

    await HistoryLog.create({
      action: 'Bulk Upload Subjects',
      details: `Bulk uploaded ${results.added.length} subjects to ${activeDept} — Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.json({
      message: `Processed ${parsed.length} rows`,
      added: results.added.length,
      skipped: results.skipped.length,
      errors: results.errors,
      addedCodes: results.added,
      skippedCodes: results.skipped
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all subjects (optionally filtered by department or semester)
router.get('/public', async (req, res) => {
  try {
          const { department, semester, regulation } = req.query;
    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }
    const filter = { department };
    if (semester) filter.semester = parseInt(semester);
          if (regulation) filter.regulation = { $regex: regulation, $options: 'i' };

    const subjects = await Subject.find(filter).sort({ semester: 1, code: 1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    let department = req.query.department || req.user.department;
    let semester = req.query.semester;
    let regulation = req.query.regulation;

    // Data isolation check for non-super_admins
    if (req.user.role !== 'super_admin' && department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Cannot access other departments' });
    }

    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }

    const filter = { department };
    if (semester) filter.semester = parseInt(semester);
    if (regulation) filter.regulation = { $regex: regulation, $options: 'i' };

    const subjects = await Subject.find(filter).sort({ semester: 1, code: 1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Subject
router.post('/', protect, hasPermission('EDIT_SUBJECT_CATALOGUE'), async (req, res) => {
  const { code, name, credits, semester, department, regulation } = req.body;

  try {
    const activeDept = department || req.user.department;

    if (req.user.role !== 'super_admin' && activeDept !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Cannot write to other departments' });
    }

    const existing = await Subject.findOne({ code: code.toUpperCase(), department: activeDept });
    if (existing) {
      return res.status(400).json({ message: 'Subject code already exists in this department' });
    }

    const subject = await Subject.create({
      code: code.toUpperCase(),
      name,
      credits: parseInt(credits) || 0,
      semester: parseInt(semester),
      department: activeDept,
      regulation: regulation || 'R2021'
    });

    await HistoryLog.create({
      action: 'Create Subject',
      details: `Created subject ${name} (${code}) in department ${activeDept}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: activeDept
    });

    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Subject
router.put('/:id', protect, hasPermission('EDIT_SUBJECT_CATALOGUE'), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (req.user.role !== 'super_admin' && subject.department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Not authorized' });
    }

    const { code, name, credits, semester, regulation } = req.body;

    // If code is being changed, check for duplicate in the same department
    if (code && code.toUpperCase() !== subject.code) {
      const duplicate = await Subject.findOne({
        code: code.toUpperCase(),
        department: subject.department,
        _id: { $ne: subject._id }
      });
      if (duplicate) {
        return res.status(400).json({ message: `Subject code "${code.toUpperCase()}" already exists in this department` });
      }
      subject.code = code.toUpperCase();
    }

    subject.name = name || subject.name;
    subject.credits = credits !== undefined ? (parseInt(credits) || 0) : subject.credits;
    subject.semester = semester !== undefined ? parseInt(semester) : subject.semester;
    subject.regulation = regulation || subject.regulation;

    const updatedSubject = await subject.save();

    await HistoryLog.create({
      action: 'Update Subject',
      details: `Updated subject ${subject.name} (${subject.code})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: subject.department
    });

    res.json(updatedSubject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Subject
router.delete('/:id', protect, hasPermission('EDIT_SUBJECT_CATALOGUE'), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    if (req.user.role !== 'super_admin' && subject.department !== req.user.department) {
      return res.status(403).json({ message: 'Forbidden: Not authorized' });
    }

    await Subject.findByIdAndDelete(req.params.id);

    await HistoryLog.create({
      action: 'Delete Subject',
      details: `Deleted subject ${subject.name} (${subject.code})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: subject.department
    });

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
