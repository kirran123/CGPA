const express = require('express');
const router = express.Router();
const GpaRecord = require('../models/GpaRecord');
const CgpaRecord = require('../models/CgpaRecord');
const HistoryLog = require('../models/HistoryLog');
const { protect } = require('../middleware/auth');

// Get department dashboard stats and charts data
router.get('/dashboard-stats', protect, async (req, res) => {
  const department = req.query.department || req.user.department;

  try {
    let stats = {};
    let distribution = [];
    let trends = [];
    let rankings = [];
    let recentRecords = [];
    let departmentOverviews = [];

    const isSuperAdminGlobal = (req.user.role === 'super_admin' && !req.query.department);

    if (isSuperAdminGlobal) {
      // Super Admin Global View
      const [gpaTotal, cgpaTotal] = await Promise.all([
        GpaRecord.countDocuments({}),
        CgpaRecord.countDocuments({})
      ]);
      const totalRecords = gpaTotal + cgpaTotal;

      const [gpaUnique, cgpaUnique] = await Promise.all([
        GpaRecord.distinct('registerNo', {}),
        CgpaRecord.distinct('registerNo', {})
      ]);
      const uniqueStudentsSet = new Set([...gpaUnique, ...cgpaUnique]);
      const totalStudentsCount = uniqueStudentsSet.size;

      const gpaAvgStats = await GpaRecord.aggregate([{ $group: { _id: null, sumGpa: { $sum: '$gpa' }, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);
      const cgpaAvgStats = await CgpaRecord.aggregate([{ $group: { _id: null, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);

      const gCount = gpaAvgStats[0] ? gpaAvgStats[0].count : 0;
      const overallAvgGpa = gCount > 0 ? (gpaAvgStats[0].sumGpa / gCount) : 0;

      const sumCgpa = (cgpaAvgStats[0] ? cgpaAvgStats[0].sumCgpa : 0) + (gpaAvgStats[0] ? gpaAvgStats[0].sumCgpa : 0);
      const cCount = (cgpaAvgStats[0] ? cgpaAvgStats[0].count : 0) + gCount;
      const overallAvgCgpa = cCount > 0 ? sumCgpa / cCount : 0;

      stats = {
        totalRecords,
        totalStudents: totalStudentsCount,
        avgGpa: parseFloat(overallAvgGpa.toFixed(2)),
        avgCgpa: parseFloat(overallAvgCgpa.toFixed(2))
      };

      // Get all active departments and calculate their stats
      const Department = require('../models/Department');
      const depts = await Department.find({ status: 'Active' }).sort({ name: 1 });
      for (const d of depts) {
        const [dGpaCount, dCgpaCount] = await Promise.all([
          GpaRecord.countDocuments({ department: d.code }),
          CgpaRecord.countDocuments({ department: d.code })
        ]);
        const dRecordsCount = dGpaCount + dCgpaCount;

        const [dGpaUnique, dCgpaUnique] = await Promise.all([
          GpaRecord.distinct('registerNo', { department: d.code }),
          CgpaRecord.distinct('registerNo', { department: d.code })
        ]);
        const dUniqueStudents = new Set([...dGpaUnique, ...dCgpaUnique]);
        
        // Compute averages
        const dGpaAvgStats = await GpaRecord.aggregate([{ $match: { department: d.code } }, { $group: { _id: null, sumGpa: { $sum: '$gpa' }, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);
        const dCgpaAvgStats = await CgpaRecord.aggregate([{ $match: { department: d.code } }, { $group: { _id: null, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);

        const dgCount = dGpaAvgStats[0] ? dGpaAvgStats[0].count : 0;
        const dAvgGpa = dgCount > 0 ? (dGpaAvgStats[0].sumGpa / dgCount) : 0;

        const dSumCgpa = (dCgpaAvgStats[0] ? dCgpaAvgStats[0].sumCgpa : 0) + (dGpaAvgStats[0] ? dGpaAvgStats[0].sumCgpa : 0);
        const dcCount = (dCgpaAvgStats[0] ? dCgpaAvgStats[0].count : 0) + dgCount;
        const dAvgCgpa = dcCount > 0 ? dSumCgpa / dcCount : 0;

        departmentOverviews.push({
          code: d.code,
          name: d.name,
          hodName: d.hodName || 'Pending Appointment',
          email: d.email || `${d.code.toLowerCase()}hod@rit.edu.in`,
          totalRecords: dRecordsCount,
          totalStudents: dUniqueStudents.size,
          avgGpa: parseFloat(dAvgGpa.toFixed(2)),
          avgCgpa: parseFloat(dAvgCgpa.toFixed(2))
        });
      }

      departmentOverviews.sort((a, b) => {
        const codeA = (a.code || '').toUpperCase();
        const codeB = (b.code || '').toUpperCase();
        if (codeA === 'IT' && codeB !== 'IT') return -1;
        if (codeB === 'IT' && codeA !== 'IT') return 1;
        if (codeA === 'CYBER' && codeB !== 'CYBER') return 1;
        if (codeB === 'CYBER' && codeA !== 'CYBER') return -1;
        return (a.name || '').localeCompare(b.name || '');
      });

      // Recent calculations (global)
      const recentGpa = await GpaRecord.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('calculatedBy', 'name')
        .select('studentName registerNo semester gpa cgpa createdAt department calculatedBy').lean();
      const recentCgpa = await CgpaRecord.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('calculatedBy', 'name')
        .select('studentName registerNo cgpa createdAt department calculatedBy').lean();
      recentRecords = [...recentGpa, ...recentCgpa]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

    } else {
      // Local Department-level View
      if (req.user.role !== 'super_admin' && department !== req.user.department) {
        return res.status(403).json({ message: 'Forbidden: Access denied' });
      }

      const filter = { department };
      if (req.user.role === 'dept_admin' || req.user.role === 'staff') {
        filter.calculatedBy = req.user._id;
      }

      // 1. Basic Stats
      const [gpaTotal, cgpaTotal] = await Promise.all([
        GpaRecord.countDocuments(filter),
        CgpaRecord.countDocuments(filter)
      ]);
      const totalRecords = gpaTotal + cgpaTotal;

      const [gpaUnique, cgpaUnique] = await Promise.all([
        GpaRecord.distinct('registerNo', filter),
        CgpaRecord.distinct('registerNo', filter)
      ]);
      const uniqueStudentsSet = new Set([...gpaUnique, ...cgpaUnique]);
      const totalStudentsCount = uniqueStudentsSet.size;

      const gpaAvgStats = await GpaRecord.aggregate([{ $match: filter }, { $group: { _id: null, sumGpa: { $sum: '$gpa' }, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);
      const cgpaAvgStats = await CgpaRecord.aggregate([{ $match: filter }, { $group: { _id: null, sumCgpa: { $sum: '$cgpa' }, count: { $sum: 1 } } }]);

      const gCount = gpaAvgStats[0] ? gpaAvgStats[0].count : 0;
      const overallAvgGpa = gCount > 0 ? (gpaAvgStats[0].sumGpa / gCount) : 0;

      const sumCgpa = (cgpaAvgStats[0] ? cgpaAvgStats[0].sumCgpa : 0) + (gpaAvgStats[0] ? gpaAvgStats[0].sumCgpa : 0);
      const cCount = (cgpaAvgStats[0] ? cgpaAvgStats[0].count : 0) + gCount;
      const overallAvgCgpa = cCount > 0 ? sumCgpa / cCount : 0;

      const myGpaRecordsCount = await GpaRecord.countDocuments({ department, calculatedBy: req.user._id });
      const myCgpaRecordsCount = await CgpaRecord.countDocuments({ department, calculatedBy: req.user._id });
      const myRecordsCount = myGpaRecordsCount + myCgpaRecordsCount;

      stats = {
        totalRecords,
        totalStudents: totalStudentsCount,
        avgGpa: parseFloat(overallAvgGpa.toFixed(2)),
        avgCgpa: parseFloat(overallAvgCgpa.toFixed(2)),
        myRecordsCount
      };

      // 2. GPA Distribution
      const records = await GpaRecord.find(filter);
      const distributionMap = {
        '9.0 - 10.0 (O)': 0,
        '8.0 - 8.99 (A+)': 0,
        '7.0 - 7.99 (A)': 0,
        '6.0 - 6.99 (B+)': 0,
        '5.0 - 5.99 (B)': 0,
        'Below 5.0 (RA/U)': 0
      };

      records.forEach(r => {
        const val = r.gpa;
        if (val >= 9.0) distributionMap['9.0 - 10.0 (O)']++;
        else if (val >= 8.0) distributionMap['8.0 - 8.99 (A+)']++;
        else if (val >= 7.0) distributionMap['7.0 - 7.99 (A)']++;
        else if (val >= 6.0) distributionMap['6.0 - 6.99 (B+)']++;
        else if (val >= 5.0) distributionMap['5.0 - 5.99 (B)']++;
        else distributionMap['Below 5.0 (RA/U)']++;
      });

      distribution = Object.keys(distributionMap).map(range => ({
        range,
        count: distributionMap[range]
      }));

      // 3. Semester Averages
      const semTrends = await GpaRecord.aggregate([
        { $match: filter },
        { $group: { _id: '$semester', avgGpa: { $avg: '$gpa' } } },
        { $sort: { _id: 1 } }
      ]);
      trends = semTrends.map(t => ({
        semester: `Sem ${t._id}`,
        avgGpa: parseFloat(t.avgGpa.toFixed(2))
      }));

      // 4. Rankings
      const studentLatest = await GpaRecord.aggregate([
        { $match: filter },
        { $sort: { semester: -1 } },
        { $group: {
            _id: '$registerNo',
            studentName: { $first: '$studentName' },
            cgpa: { $first: '$cgpa' },
            semester: { $first: '$semester' }
          }
        },
        { $sort: { cgpa: -1 } },
        { $limit: 10 }
      ]);

      rankings = studentLatest.map((s, idx) => ({
        rank: idx + 1,
        registerNo: s._id,
        name: s.studentName,
        cgpa: s.cgpa,
        semester: s.semester
      }));

      // Recent calculations (department)
      const recentGpa = await GpaRecord.find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('calculatedBy', 'name')
        .select('studentName registerNo semester gpa cgpa createdAt department calculatedBy').lean();
      const recentCgpa = await CgpaRecord.find(filter)
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('calculatedBy', 'name')
        .select('studentName registerNo cgpa createdAt department calculatedBy').lean();
      recentRecords = [...recentGpa, ...recentCgpa]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    }

    res.json({
      stats,
      distribution,
      trends,
      rankings,
      recentRecords,
      departmentOverviews
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get activity logs history
router.get('/history', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'dept_admin' || req.user.role === 'staff') {
      filter = { performedBy: req.user._id };
    }

    const logs = await HistoryLog.find(filter).sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
