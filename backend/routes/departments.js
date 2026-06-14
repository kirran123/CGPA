const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const User = require('../models/User');
const HistoryLog = require('../models/HistoryLog');
const GpaRecord = require('../models/GpaRecord');
const CgpaRecord = require('../models/CgpaRecord');
const { protect, authorize } = require('../middleware/auth');
const { syncAllHods } = require('../services/hodSync');

const sortDepartmentsCustom = (depts) => {
  return depts.sort((a, b) => {
    const codeA = (a.code || '').toUpperCase();
    const codeB = (b.code || '').toUpperCase();
    
    // IT goes first
    if (codeA === 'IT' && codeB !== 'IT') return -1;
    if (codeB === 'IT' && codeA !== 'IT') return 1;
    
    // CYBER goes last
    if (codeA === 'CYBER' && codeB !== 'CYBER') return 1;
    if (codeB === 'CYBER' && codeA !== 'CYBER') return -1;
    
    // Alphabetical for others by name
    return (a.name || '').localeCompare(b.name || '');
  });
};

// Get all departments (Super Admin gets all, others get active)
router.get('/public', async (req, res) => {
  try {
    const departments = await Department.find({ status: 'Active' });
    res.json(sortDepartmentsCustom(departments));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'super_admin' ? {} : { status: 'Active' };
    const departments = await Department.find(filter);
    res.json(sortDepartmentsCustom(departments));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Department (Super Admin only)
router.post('/', protect, authorize('super_admin'), async (req, res) => {
  const { name, code, description, hodName, email, status } = req.body;

  try {
    const existing = await Department.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Department code already exists' });
    }

    const department = await Department.create({
      name,
      code: code.toUpperCase(),
      description,
      hodName,
      email,
      status: status || 'Active'
    });

    await syncAllHods();
    const syncedDept = await Department.findById(department._id);

    await HistoryLog.create({
      action: 'Create Department',
      details: `Created department ${name} (${code})`,
      performedBy: req.user._id,
      performedByName: req.user.name
    });

    res.status(201).json(syncedDept);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Department (Super Admin only)
router.put('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const { name, description, hodName, email, status } = req.body;
    department.name = name || department.name;
    department.description = description !== undefined ? description : department.description;
    department.hodName = hodName !== undefined ? hodName : department.hodName;
    department.email = email !== undefined ? email : department.email;
    department.status = status || department.status;

    const updatedDept = await department.save();

    await syncAllHods();
    const syncedDept = await Department.findById(updatedDept._id);

    await HistoryLog.create({
      action: 'Update Department',
      details: `Updated department ${department.name} (${department.code})`,
      performedBy: req.user._id,
      performedByName: req.user.name
    });

    res.json(syncedDept);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Department stats (Super Admin only)
router.get('/stats', protect, authorize('super_admin'), async (req, res) => {
  try {
    // Always sync HOD data from staff records before returning
    await syncAllHods();

    const deptStats = [];
    const depts = await Department.find();

    for (const d of depts) {
      const gpaStudents = await GpaRecord.distinct('registerNo', { department: d.code });
      const cgpaStudents = await CgpaRecord.distinct('registerNo', { department: d.code });
      const studentCount = new Set([...gpaStudents, ...cgpaStudents]);

      const staffCount = await User.countDocuments({ department: d.code, role: { $ne: 'super_admin' } });
      const avgGpaResult = await GpaRecord.aggregate([
        { $match: { department: d.code } },
        { $group: { _id: null, avgGpa: { $avg: '$gpa' } } }
      ]);
      const avgGpa = avgGpaResult[0] ? avgGpaResult[0].avgGpa.toFixed(2) : 'N/A';

      deptStats.push({
        _id: d._id,
        code: d.code,
        name: d.name,
        description: d.description,
        hodName: d.hodName || 'Pending Appointment',
        email: d.email || `${d.code.toLowerCase()}hod@rit.edu.in`,
        status: d.status,
        students: studentCount.size,
        staff: staffCount,
        avgGpa: avgGpa
      });
    }

    res.json(sortDepartmentsCustom(deptStats));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
