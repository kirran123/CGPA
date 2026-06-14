const mongoose = require('mongoose');

const semesterEntrySchema = new mongoose.Schema({
  semester: Number,
  gpa:      Number,
  credits:  Number
}, { _id: false });

const cgpaRecordSchema = new mongoose.Schema({
  studentName:  { type: String, required: true },
  registerNo:   { type: String, required: true },
  department:   { type: String, required: true },
  regulation:   { type: String, default: 'R2021' },
  semesters:    [semesterEntrySchema],
  totalCredits: Number,
  cgpa:         { type: Number, required: true },
  calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isBulk:       { type: Boolean, default: false },
  pdfUrl:       { type: String, default: '' },
  createdAt:    { type: Date, default: Date.now }
});

cgpaRecordSchema.index({ registerNo: 1, department: 1 });
module.exports = mongoose.model('CgpaRecord', cgpaRecordSchema);
