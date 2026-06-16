const mongoose = require('mongoose');

const gradeSettingSchema = new mongoose.Schema({
  regulation: { type: String, required: true },
  semester: { type: Number, required: true },
  grades: [{
    grade: { type: String, required: true },
    points: { type: Number, required: true }
  }]
}, { timestamps: true });

// Ensure unique compound index for regulation + semester
gradeSettingSchema.index({ regulation: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('GradeSetting', gradeSettingSchema);
