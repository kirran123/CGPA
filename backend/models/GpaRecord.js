const mongoose = require('mongoose');

const gradeDetailSchema = new mongoose.Schema({
  subjectCode:  String,
  subjectName:  String,
  credits:      Number,
  grade:        String,
  gradePoint:   Number,
  creditPoints: Number
}, { _id: false });

const gpaRecordSchema = new mongoose.Schema({
  studentName:   { type: String, required: true },
  registerNo:    { type: String, required: true },
  semester:      { type: Number, required: true },
  regulation:    { type: String, default: 'R2021' },
  department:    { type: String, required: true },
  subjects:      [gradeDetailSchema],
  totalCredits:  Number,
  totalPoints:   Number,
  gpa:           { type: Number, required: true },
  cgpa:          { type: Number, default: 0 },
  calculatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isBulk:        { type: Boolean, default: false },
  batchName:     { type: String, default: '' },   // e.g. "Batch 1 – IT Sem 3"
  batchId:       { type: String, default: '' },   // slug for grouping, e.g. "IT-3-1718000000000"
  pdfUrl:        { type: String, default: '' },
  createdAt:     { type: Date, default: Date.now }
});

gpaRecordSchema.index({ registerNo: 1, semester: 1, department: 1 }, { unique: true });
module.exports = mongoose.model('GpaRecord', gpaRecordSchema);
