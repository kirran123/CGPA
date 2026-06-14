const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PERMISSIONS = [
  'FULL_ACCESS',            // Full access — all powers across all departments
  'DEPT_ACCESS',            // Department access — only department powers
  'DEPT_FULL_ACCESS',       // Backward compatibility
  'DEPARTMENT_FULL_ACCESS', // Backward compatibility
  'READ_ONLY',              // Read-only — can view records but not mutate
  'EDIT_SUBJECT_CATALOGUE'  // Can add/edit/delete subjects in the syllabus catalog
];

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  employeeId:  { type: String, default: '' },
  email:       { type: String, required: true, unique: true, lowercase: true },
  mobile:      { type: String, default: '' },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['super_admin','dept_admin','staff'], required: true },
  department:  { type: String, default: '' },
  designation: { type: String, default: '' },
  permissions: [{ type: String, enum: PERMISSIONS }],
  status:      { type: String, enum: ['Active','Inactive'], default: 'Active' },
  firstLogin:  { type: Boolean, default: true },
  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
  loginHistory: [{
    ip:        String,
    userAgent: String,
    loginAt:   { type: Date, default: Date.now }
  }],
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now }
});

userSchema.methods.matchPassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);
