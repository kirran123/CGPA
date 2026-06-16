const express = require('express');
const router = express.Router();
const GradeSetting = require('../models/GradeSetting');
const HistoryLog = require('../models/HistoryLog');
const { protect } = require('../middleware/auth');

// Default grade point mapping to fall back on
const DEFAULT_GRADES = [
  { grade: 'O', points: 10 },
  { grade: 'A+', points: 9 },
  { grade: 'A', points: 8 },
  { grade: 'B+', points: 7 },
  { grade: 'B', points: 6 },
  { grade: 'C', points: 5 },
  { grade: 'U', points: 0 },
  { grade: 'RA', points: 0 }
];

// 1. Get grade settings for a specific regulation and semester (Public — anonymous access allowed)
router.get('/:regulation/:semester', async (req, res) => {
  const { regulation, semester } = req.params;
  const semNum = parseInt(semester);

  if (isNaN(semNum) || semNum < 1 || semNum > 8) {
    return res.status(400).json({ message: 'Invalid semester' });
  }

  try {
    // case-insensitive match for regulation
    const setting = await GradeSetting.findOne({
      regulation: { $regex: new RegExp(`^${regulation}$`, 'i') },
      semester: semNum
    });

    if (setting) {
      return res.json(setting);
    }

    // Fallback to defaults
    return res.json({
      regulation,
      semester: semNum,
      grades: DEFAULT_GRADES
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Save/Update grade settings (Protected — staff, HOD, and Super Admin only)
router.post('/', protect, async (req, res) => {
  const { regulation, semester, grades } = req.body;
  const semNum = parseInt(semester);

  if (!regulation || isNaN(semNum) || semNum < 1 || semNum > 8 || !Array.isArray(grades)) {
    return res.status(400).json({ message: 'Invalid payload parameters' });
  }

  // Validate and sanitize grades array
  const sanitizedGrades = [];
  for (const item of grades) {
    const rawGrade = String(item.grade || '').trim().toUpperCase();
    const rawPoints = parseFloat(item.points);

    if (!rawGrade) {
      return res.status(400).json({ message: 'Grade name cannot be empty' });
    }
    if (isNaN(rawPoints) || rawPoints < 0 || rawPoints > 10) {
      return res.status(400).json({ message: `Invalid points value for grade ${rawGrade}. Must be between 0 and 10.` });
    }

    sanitizedGrades.push({ grade: rawGrade, points: rawPoints });
  }

  try {
    const setting = await GradeSetting.findOneAndUpdate(
      { regulation, semester: semNum },
      { regulation, semester: semNum, grades: sanitizedGrades },
      { upsert: true, new: true }
    );

    await HistoryLog.create({
      action: 'Update Grade System',
      details: `Configured grade system for regulation ${regulation}, semester ${semNum} with ${sanitizedGrades.length} grades.`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: req.user.department || ''
    });

    res.status(200).json(setting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
