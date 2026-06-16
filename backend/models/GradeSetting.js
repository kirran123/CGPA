const mongoose = require('mongoose');

const gradeSettingSchema = new mongoose.Schema({
  department: { type: String, required: true },
  regulation: { type: String, required: true },
  semester: { type: Number, required: true },
  grades: [{
    grade: { type: String, required: true },
    points: { type: Number, required: true }
  }]
}, { timestamps: true });

// Ensure unique compound index for department + regulation + semester
gradeSettingSchema.index({ department: 1, regulation: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('GradeSetting', gradeSettingSchema);
