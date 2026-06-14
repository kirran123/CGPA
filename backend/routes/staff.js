const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const HistoryLog = require('../models/HistoryLog');
const { protect, authorize } = require('../middleware/auth');
const { syncAllHods } = require('../services/hodSync');

// Get staff list
router.get('/', protect, async (req, res) => {
  try {
    let filter = {};
    
    // If Dept Admin, only see staff in their department
    if (req.user.role === 'dept_admin') {
      filter = { department: req.user.department, role: { $ne: 'super_admin' } };
    } else if (req.user.role === 'staff') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const staff = await User.find(filter).select('-password').sort({ name: 1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Staff / Department Admin (Super Admin can create both, Dept Admin can only create staff)
router.post('/', protect, authorize('super_admin', 'dept_admin'), async (req, res) => {
  const { name, email, password, role, department, permissions } = req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Enforce role creation rules
    let assignedRole = role;
    let assignedDept = department;
    let assignedPerms = permissions || [];

    if (req.user.role === 'dept_admin') {
      assignedRole = 'staff'; // Can only create staff
      assignedDept = req.user.department; // Hardcode to their department
      
      // Enforce HOD view_only block
      if (req.user.permissions?.includes('VIEW_ONLY')) {
        return res.status(403).json({ message: 'Permission denied: Read-only access' });
      }
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role: assignedRole,
      department: assignedDept || '',
      permissions: assignedPerms,
      status: 'Active'
    });

    await HistoryLog.create({
      action: 'Create Staff',
      details: `Created user ${name} (${assignedRole}) with permissions [${assignedPerms.join(', ')}] for ${assignedDept || 'System'}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: assignedDept
    });

    // Sync HOD details across all departments
    await syncAllHods();

    const returnedUser = newUser.toObject();
    delete returnedUser.password;

    res.status(201).json(returnedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update staff status/details or password reset
router.put('/:id', protect, authorize('super_admin', 'dept_admin'), async (req, res) => {
  try {
    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Data isolation check
    if (req.user.role === 'dept_admin') {
      if (staffUser.department !== req.user.department) {
        return res.status(403).json({ message: 'Not authorized for this department' });
      }
      if (req.user.permissions?.includes('VIEW_ONLY')) {
        return res.status(403).json({ message: 'Permission denied: Read-only access' });
      }
    }

    // Prevent editing own details/account for non-super admins
    if (req.params.id === req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden: You cannot edit your own account details' });
    }

    const { name, email, status, role, password, department, permissions } = req.body;

    staffUser.name = name || staffUser.name;
    
    if (email && email.toLowerCase() !== staffUser.email.toLowerCase()) {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Forbidden: Only Super Admin can change email addresses' });
      }
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      staffUser.email = email.toLowerCase();
    }

    if (staffUser.role === 'super_admin' && status === 'Inactive') {
      return res.status(400).json({ message: 'Cannot deactivate a Super Admin account' });
    }
    staffUser.status = status || staffUser.status;

    if (req.user.role === 'super_admin') {
      if (role) staffUser.role = role;
      if (department !== undefined) staffUser.department = department || '';
      if (permissions !== undefined) staffUser.permissions = permissions;
    } else if (req.user.role === 'dept_admin') {
      // HOD can update staff permissions and roles in their department
      if (role && (role === 'staff' || role === 'dept_admin')) {
        staffUser.role = role;
      }
      if (permissions !== undefined) staffUser.permissions = permissions;
    }

    if (password) {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Forbidden: Only Super Admin can reset passwords' });
      }
      staffUser.password = password; // Pre-save hook will hash it automatically
    }

    const updatedUser = await staffUser.save();

    // Sync HOD details across all departments
    await syncAllHods();

    await HistoryLog.create({
      action: password ? 'Reset Staff Password' : 'Update Staff Details',
      details: `Updated user ${staffUser.name} (${staffUser.email})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: staffUser.department
    });

    const returnedUser = updatedUser.toObject();
    delete returnedUser.password;

    res.json(returnedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Staff
router.delete('/:id', protect, authorize('super_admin', 'dept_admin'), async (req, res) => {
  try {
    const staffUser = await User.findById(req.params.id);
    if (!staffUser) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Prevent deleting Super Admin accounts
    if (staffUser.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot delete a Super Admin account' });
    }

    // Prevent deleting own account
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Data isolation check
    if (req.user.role === 'dept_admin') {
      if (staffUser.department !== req.user.department) {
        return res.status(403).json({ message: 'Not authorized for this department' });
      }
      if (req.user.permissions?.includes('VIEW_ONLY')) {
        return res.status(403).json({ message: 'Permission denied: Read-only access' });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    // Sync HOD details across all departments
    await syncAllHods();

    await HistoryLog.create({
      action: 'Delete Staff',
      details: `Deleted user ${staffUser.name} (${staffUser.email})`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      department: staffUser.department
    });

    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
