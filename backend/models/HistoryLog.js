const mongoose = require('mongoose');

const historyLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  details: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, required: true },
  department: { type: String, default: '' }, // Dept code if relevant
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HistoryLog', historyLogSchema);
