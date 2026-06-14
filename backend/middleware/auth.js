const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'User inactive or not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};

/**
 * Permission system — 3 roles:
 *  DEPT_FULL_ACCESS       — full access within their department
 *  READ_ONLY              — read-only, cannot mutate
 *  EDIT_SUBJECT_CATALOGUE — can add/edit/delete subjects only
 *
 * super_admin always passes.
 * dept_admin with no permissions defaults to full access for their dept.
 * staff must have explicit permission.
 */
const hasPermission = (...perms) => (req, res, next) => {
  const role = req.user?.role;

  // Super admin bypasses all checks
  if (role === 'super_admin') return next();

  const rawPerms = req.user?.permissions || [];
  const userPerms = [...rawPerms];
  if (rawPerms.includes('FULL_ACCESS')) {
    userPerms.push('DEPT_FULL_ACCESS', 'DEPT_ACCESS', 'EDIT_SUBJECT_CATALOGUE');
  }
  if (rawPerms.includes('DEPT_ACCESS') || rawPerms.includes('DEPARTMENT_FULL_ACCESS')) {
    userPerms.push('DEPT_FULL_ACCESS');
  }
  if (rawPerms.includes('DEPT_FULL_ACCESS')) {
    userPerms.push('DEPT_ACCESS');
  }

  // READ_ONLY blocks all mutating requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (userPerms.includes('READ_ONLY')) {
      return res.status(403).json({ message: 'Permission denied: Read-only access' });
    }
  }

  // DEPT_FULL_ACCESS/DEPT_ACCESS grants full access within their department
  if (userPerms.includes('DEPT_FULL_ACCESS') || userPerms.includes('DEPT_ACCESS')) return next();

  // dept_admin with no explicit permissions defaults to full dept access
  if (role === 'dept_admin' && userPerms.length === 0) return next();

  // Check for specific required permissions
  if (perms.length > 0) {
    const granted = perms.some(p => userPerms.includes(p));
    if (!granted) {
      // dept_admin without explicit restriction can still proceed for GPA/CGPA
      if ((role === 'dept_admin' || role === 'staff') && !userPerms.includes('READ_ONLY')) return next();
      return res.status(403).json({ message: 'Permission denied: Missing required permission' });
    }
  }

  next();
};

module.exports = { protect, authorize, hasPermission };
