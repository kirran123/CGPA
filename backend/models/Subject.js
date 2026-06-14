const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  credits: { type: Number, required: true },
  semester: { type: Number, required: true },
  department: { type: String, required: true }, // Dept Code (e.g. CSE)
  regulation: { type: String, default: 'R2021' }
});

// Compound index to ensure subject code is unique per department and regulation
subjectSchema.index({ code: 1, department: 1, regulation: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
