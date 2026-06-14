const mongoose = require('mongoose');

const bulkJobSchema = new mongoose.Schema({
  type:         { type: String, enum: ['GPA','CGPA'], required: true },
  department:   { type: String, required: true },
  semester:     Number,
  regulation:   String,
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fileName:     String,
  status:       { type: String, enum: ['pending','processing','done','failed'], default: 'pending' },
  totalRows:    { type: Number, default: 0 },
  processed:    { type: Number, default: 0 },
  errors:       [String],
  resultSummary: {
    avgGpa:  Number,
    avgCgpa: Number,
    highest: Number,
    lowest:  Number,
    pass:    Number,
    fail:    Number
  },
  createdAt:    { type: Date, default: Date.now },
  completedAt:  Date
});

module.exports = mongoose.model('BulkJob', bulkJobSchema);
