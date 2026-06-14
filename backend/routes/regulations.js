const express = require('express');
const router = express.Router();
const Regulation = require('../models/Regulation');
const { protect, authorize } = require('../middleware/auth');

// Get all regulations (Public)
router.get('/', async (req, res) => {
  try {
    const regs = await Regulation.find().sort({ name: 1 });
    res.json(regs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a regulation (Super Admin only)
router.post('/', protect, authorize('super_admin'), async (req, res) => {
  let { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Regulation name is required' });
  }

  let formattedName = name.trim().toUpperCase();
  if (!formattedName.startsWith('R')) {
    if (formattedName.length === 2) {
      formattedName = 'R20' + formattedName;
    } else if (formattedName.length === 4) {
      formattedName = 'R' + formattedName;
    } else {
      formattedName = 'R' + formattedName;
    }
  } else {
    const numPart = formattedName.substring(1);
    if (numPart.length === 2) {
      formattedName = 'R20' + numPart;
    }
  }

  try {
    const existing = await Regulation.findOne({ name: formattedName });
    if (existing) {
      return res.status(400).json({ message: `Regulation ${formattedName} already exists` });
    }
    const newReg = await Regulation.create({ name: formattedName });
    res.status(201).json(newReg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
